'use strict';

/**
 * SheetsSync (Google Apps Script Web App Remote Sync Engine)
 * 
 * - 로컬 서버와 Google Sheets 간의 안전한 비동기(Fire-and-Forget) 원격 동기화
 * - 1인 관람객 = 1행 실시간 여정 갱신 (세션로그_YYYY-MM 월별 자동 분할)
 * - 10분 주기 KPI 스냅샷 누적 (스냅샷_이력) 및 첫 페이지 대시보드 자동 갱신
 * - 네트워크 지연 및 단절 시에도 메인 키오스크 렌더링에 0.001초의 영향도 주지 않음
 */

const configModule = require('./config');

class SheetsSync {
  getConfig() {
    const cfg = configModule.getConfig();
    return {
      enabled: Boolean(cfg.googleSheets && cfg.googleSheets.enabled),
      webAppUrl: (cfg.googleSheets && cfg.googleSheets.webAppUrl) || process.env.GOOGLE_SHEETS_WEBAPP_URL || ''
    };
  }

  isEnabled() {
    const { enabled, webAppUrl } = this.getConfig();
    return enabled && typeof webAppUrl === 'string' && webAppUrl.startsWith('https://script.google.com/');
  }

  async postToWebApp(payload) {
    if (!this.isEnabled()) {
      return { skipped: true };
    }

    const { webAppUrl } = this.getConfig();

    try {
      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        redirect: 'follow', // Google Apps Script 302 리다이렉트 자동 추적
        signal: AbortSignal.timeout(10000) // 최대 10초 타임아웃
      });

      return { status: res.status, ok: res.ok };
    } catch (err) {
      // fire-and-forget: 네트워크 실패나 구글 일시 에러 시 조용히 경고 로그만 남김
      console.warn(`[Google Sheets Sync] 전송 실패 (${payload.action}):`, err.message);
      return { error: err.message };
    }
  }

  /**
   * 관람객 1명의 실시간 세션 여정을 구글 시트에 Upsert
   * @param {object} audit - session.logger.js의 audit 객체
   */
  async syncSessionRow(audit) {
    if (!this.isEnabled() || !audit || !audit.sessionId) return;

    try {
      const shot1Cap = audit.shot1?.captureSuccess ? '성공' : (audit.shot1?.captureStarted ? '시도' : '미촬영');
      const shot1Mos = audit.shot1?.mosaicSuccess ? '성공' : (audit.shot1?.mosaicAttempted ? '실패' : '미합성');

      // 1샷 즉시 파이프라인 (2회차 선택 제거됨)
      const retryChoice = audit.decision?.choice ? audit.decision.choice : '1회완료(단일)';
      const shot2Mos = audit.shot2?.mosaicSuccess ? '성공' : '-';

      const downloadCount = audit.downloads?.totalCount || 0;
      const downloadStr = downloadCount > 0 ? `완료 (${downloadCount}회)` : '미다운로드';

      let staySecStr = '';
      if (audit.totalStaySec) {
        staySecStr = `${audit.totalStaySec}s`;
      } else if (audit.createdAt) {
        staySecStr = `${((Date.now() - audit.createdAt) / 1000).toFixed(0)}s`;
      }

      // 월별 분할 키 (예: "2026-09")
      const createdAtDate = audit.createdAt ? new Date(audit.createdAt) : new Date();
      const yyyy = createdAtDate.getFullYear();
      const mm = String(createdAtDate.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;

      const data = {
        세션ID: audit.sessionId,
        '접근일시(KST)': audit.accessTime || new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        촬영완료: shot1Cap,
        모자이크생성: shot1Mos,
        다운로드: downloadStr,
        최종상태: audit.finalStatus || 'IN_PROGRESS',
        체류시간: staySecStr,
        기기환경: (audit.userAgent && audit.userAgent.includes('Mobile')) ? '모바일' : 'PC/기타',
        테마: audit.shot1?.theme || '기본',
        monthKey: monthKey
      };

      return this.postToWebApp({ action: 'sessionRow', data });
    } catch (err) {
      console.warn('[Google Sheets Sync] 세션 행 포맷팅 오류:', err.message);
    }
  }

  /**
   * 집계 통계 스냅샷을 구글 시트에 누적 및 대시보드 갱신
   * @param {object} stats - sessionLogger.getAggregatedStats() 반환값
   */
  async syncSummary(stats) {
    if (!this.isEnabled() || !stats) return;

    try {
      const now = new Date();
      const kstTime = now.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;

      const data = {
        '시각(KST)': kstTime,
        총참여자: stats.totalSessions || 0,
        완주수: stats.completedCount || 0,
        완주율: stats.completionRate ? `${stats.completionRate}%` : '0.0%',
        촬영율: stats.captureRate ? `${stats.captureRate}%` : '0.0%',
        업로드율: stats.uploadRate ? `${stats.uploadRate}%` : '0.0%',
        모자이크율: stats.mosaicRate ? `${stats.mosaicRate}%` : '0.0%',
        재도전율: stats.retryRate ? `${stats.retryRate}%` : '0.0%',
        다운로드율: stats.downloadRate ? `${stats.downloadRate}%` : '0.0%',
        평균체류시간: stats.avgStaySec ? `${stats.avgStaySec}s` : '0.0s',
        monthKey: monthKey
      };

      return this.postToWebApp({ action: 'summary', data });
    } catch (err) {
      console.warn('[Google Sheets Sync] 요약 통계 포맷팅 오류:', err.message);
    }
  }
}

module.exports = new SheetsSync();
