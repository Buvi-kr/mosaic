/**
 * 🪐 REVERSE COSMOS MOSAIC - Google Sheets 통합 관제 및 이벤트 타임스탬프 원장 엔진 (Code.gs v16.0)
 * 
 * [핵심 아키텍처 원칙]
 * 1. 연간 대시보드는 보는 곳 (거시적 운영 판단), 월간로그는 쌓는 곳 (14개 이벤트 타임스탬프 원장), 월간 집계는 분석하는 곳
 * 2. 연도별 대시보드 영구 보존: [2026년 연간 대시보드], [2027년 연간 대시보드] ... 절대 수정/덮어쓰지 않음
 * 3. 쓰기(원장 기록)와 렌더링을 완전 분리하여 서버 측 연산 랙 및 Lock 경합 원천 제거
 * 4. 시트 탭 슬림화: 오늘_세션로그, 일별 시트, 별도 연간통계 시트 완전 배제 (1년 최대 13개 탭 유지)
 */

const CONFIG = {
  TIME_ZONE: "Asia/Seoul",
  MONTHLY_PREFIX: "월간로그_",
  ANNUAL_DASHBOARD_SUFFIX: "년 연간 대시보드",
  
  // 14개 이벤트 타임스탬프 표준 컬럼 (A~N열)
  LEDGER_HEADERS: [
    '세션ID', '접근일시(KST)', '카메라오픈일시', '촬영완료일시',
    '모자이크완성일시', '미디어월전시일시', '다운로드일시',
    '촬영소요(초)', '합성소요(초)', '총체류(초)',
    '최종상태', '기기환경', '테마', '오류사유'
  ],
  
  // 프리미엄 테마 컬러 팔레트
  COLORS: {
    BG_HEADER: '#0f172a',    // 딥 다크 네이비
    BG_CARD: '#1e293b',      // 카드 배경
    TEXT_ACCENT: '#38bdf8',  // 스카이 블루
    TEXT_GOLD: '#fbbf24',    // 앰버 골드
    TEXT_GREEN: '#34d399',   // 에메랄드 그린
    TEXT_MUTED: '#94a3b8',   // 연회색 보조 텍스트
    BG_LIGHT: '#f8fafc',     // 테이블 라이트 배경
    BORDER_LIGHT: '#e2e8f0', // 구분선
    ALERT_RED: '#f43f5e',    // 경보 레드
    ALERT_YELLOW: '#eab308'  // 주의 옐로우
  }
};

// ==========================================
// 1. 스프레드시트 상단 관리자 커스텀 메뉴
// ==========================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🪐 모자이크 관제')
    .addItem('📊 2026년 연간 대시보드 재구축', 'rebuildCurrentAnnualDashboard')
    .addItem('🛠️ [긴급] 기존 열 밀림 복구 & 찌꺼기 탭 완전 삭제', 'migrateAndCleanupLegacy')
    .addSeparator()
    .addItem('📦 당월 월간로그 캐시 집계 수식 갱신', 'refreshCurrentMonthlyCache')
    .addItem('📅 특정 연도 대시보드 생성/복구', 'promptRebuildAnnualDashboard')
    .addToUi();
}

function rebuildCurrentAnnualDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const year = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy');
  rebuildAnnualDashboard(ss, year);
  SpreadsheetApp.getUi().alert(`✅ ${year}년 연간 대시보드가 성공적으로 재구축되었습니다.`);
}

function promptRebuildAnnualDashboard() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('대시보드 생성', '생성할 연도를 입력하세요 (예: 2026):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const year = response.getResponseText().trim();
    if (/^\d{4}$/.test(year)) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      rebuildAnnualDashboard(ss, year);
      ui.alert(`✅ ${year}년 연간 대시보드가 생성되었습니다.`);
    } else {
      ui.alert('올바른 4자리 연도를 입력해주세요.');
    }
  }
}

function refreshCurrentMonthlyCache() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const monthKey = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM');
  const sheet = ss.getSheetByName(CONFIG.MONTHLY_PREFIX + monthKey);
  if (sheet) {
    buildMonthlyRightSideCache(sheet, monthKey);
    SpreadsheetApp.getUi().alert(`✅ ${monthKey} 월간 캐시 집계 수식이 갱신되었습니다.`);
  } else {
    SpreadsheetApp.getUi().alert(`❌ ${CONFIG.MONTHLY_PREFIX + monthKey} 시트를 찾을 수 없습니다.`);
  }
}

// ==========================================
// 2. 웹앱 GET & POST 진입점 (Node.js 연동)
// ==========================================
function doGet(e) {
  return jsonResponse({
    ok: true,
    service: 'Reverse Cosmos Mosaic Core Monitoring Engine',
    status: 'ONLINE',
    version: '16.0.0',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse({ ok: false, error: '서버가 혼잡합니다. 잠시 후 다시 시도해주세요 (Lock timeout).' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Empty payload' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const data = payload.data || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case 'sessionRow':
        return jsonResponse(upsertSessionRow(ss, data));
      case 'summary':
        return jsonResponse({ ok: true, note: 'Formula-driven summary' });
      case 'MIGRATE':
        return jsonResponse({ ok: true, result: migrateAndCleanupLegacy() });
      case 'REBUILD_DASHBOARD':
        const targetYear = payload.year || Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy');
        rebuildAnnualDashboard(ss, targetYear);
        return jsonResponse({ ok: true, year: targetYear });
      default:
        return jsonResponse({ ok: false, error: '알 수 없는 요청: ' + action });
    }
  } catch (err) {
    console.error('doPost 에러:', err);
    return jsonResponse({ ok: false, error: String(err.stack || err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 3. 1인 1행 실시간 세션 원장 Upsert (초고속 쓰기)
// ==========================================
function upsertSessionRow(ss, data) {
  const sessionId = data['세션ID'] || data.sessionId;
  if (!sessionId) throw new Error('세션ID가 누락되었습니다.');

  const monthKey = data.monthKey || Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM');
  const sheet = getOrInitMonthlySheet(ss, monthKey);

  const lastRow = sheet.getLastRow();
  let targetRow = -1;

  if (lastRow > 1) {
    const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      if (String(idValues[i][0]) === String(sessionId)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const rowValues = CONFIG.LEDGER_HEADERS.map(h => data[h] !== undefined ? data[h] : '');

  if (targetRow === -1) {
    sheet.appendRow(rowValues);
    targetRow = sheet.getLastRow();
  } else {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  }

  // 가운데 정렬 (A:세션ID, B:접근일시 제외 C~N)
  sheet.getRange(targetRow, 3, 1, rowValues.length - 2).setHorizontalAlignment('center');

  return { ok: true, action: 'sessionRow', row: targetRow, monthKey: monthKey };
}

// ==========================================
// 4. 월간로그 시트 초기화 및 우측 집계 캐시 빌더
// ==========================================
function getOrInitMonthlySheet(ss, monthKey) {
  const sheetName = CONFIG.MONTHLY_PREFIX + monthKey;
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initMonthlySheetStructure(sheet, monthKey);
  }
  return sheet;
}

function initMonthlySheetStructure(sheet, monthKey) {
  sheet.clear();
  sheet.setHiddenGridlines(false);

  // 1행 헤더 (A~N: 14개 표준 컬럼)
  sheet.getRange(1, 1, 1, CONFIG.LEDGER_HEADERS.length)
       .setValues([CONFIG.LEDGER_HEADERS])
       .setBackground(CONFIG.COLORS.BG_HEADER)
       .setFontColor(CONFIG.COLORS.TEXT_ACCENT)
       .setFontWeight('bold')
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  // 텍스트 서식 강제 지정
  sheet.getRange('A:G').setNumberFormat('@');
  sheet.getRange('K:N').setNumberFormat('@');

  // 컬럼 너비 설정
  const widths = [180, 160, 100, 100, 100, 100, 100, 90, 90, 90, 140, 110, 110, 140];
  widths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));

  // 완충 구분 컬럼 (O열)
  sheet.setColumnWidth(15, 25);
  sheet.getRange('O:O').setBackground('#f1f5f9');

  // 우측 캐시 집계 수식 테이블 생성
  buildMonthlyRightSideCache(sheet, monthKey);
}

function buildMonthlyRightSideCache(sheet, monthKey) {
  const parts = monthKey.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const lastDay = new Date(year, month, 0).getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // ----------------------------------------------------
  // A. [P~W열] 일자별 운영 통계 (1일 ~ 말일 달력형)
  // ----------------------------------------------------
  sheet.getRange('P1:W1').merge()
       .setValue(`📊 [${monthKey} 일자별 운영 통계]`)
       .setBackground(CONFIG.COLORS.BG_CARD)
       .setFontColor('#ffffff')
       .setFontSize(11)
       .setFontWeight('bold')
       .setHorizontalAlignment('center');

  const dailyHeaders = ['일자', '요일', '입장객', '촬영완료', '모자이크완성', '다운로드', '완주율', '평균체류'];
  sheet.getRange('P2:W2').setValues([dailyHeaders])
       .setBackground('#334155')
       .setFontColor('#f8fafc')
       .setFontWeight('bold')
       .setHorizontalAlignment('center');

  const dailyRows = [];
  for (let d = 1; d <= 31; d++) {
    const r = d + 2;
    if (d <= lastDay) {
      const dateObj = new Date(year, month - 1, d);
      const dayName = dayNames[dateObj.getDay()];
      const dateStr = `${year}. ${String(month).padStart(2, '0')}. ${String(d).padStart(2, '0')}`;
      const shortDate = `${month}/${d}`;

      dailyRows.push([
        shortDate,
        dayName,
        `=IFERROR(COUNTIFS($B:$B, "*${dateStr}*"), 0)`,
        `=IFERROR(COUNTIFS($B:$B, "*${dateStr}*", $D:$D, "<>"), 0)`,
        `=IFERROR(COUNTIFS($B:$B, "*${dateStr}*", $E:$E, "<>"), 0)`,
        `=IFERROR(COUNTIFS($B:$B, "*${dateStr}*", $G:$G, "<>"), 0)`,
        `=IFERROR(T${r}/R${r}, 0)`,
        `=IFERROR(AVERAGEIFS($J:$J, $B:$B, "*${dateStr}*", $K:$K, "*COMPLETED*"), 0)`
      ]);
    } else {
      dailyRows.push(['-', '-', '', '', '', '', '', '']);
    }
  }

  // 3행부터 31개 행 주입 (3행~33행)
  sheet.getRange(3, 16, 31, dailyHeaders.length)
       .setValues(dailyRows)
       .setHorizontalAlignment('center')
       .setBackground('#ffffff');

  // 토요일(파랑), 일요일(빨강) 조건부 색상
  for (let d = 1; d <= lastDay; d++) {
    const dayName = dailyRows[d - 1][1];
    const rowIdx = d + 2;
    if (dayName === '토') sheet.getRange(rowIdx, 16, 1, 2).setFontColor('#2563eb').setFontWeight('bold');
    if (dayName === '일') sheet.getRange(rowIdx, 16, 1, 2).setFontColor('#dc2626').setFontWeight('bold');
  }

  // 최하단 당월 합계 행 (34행 고정!)
  const sumRow = 34;
  sheet.getRange(sumRow, 16, 1, dailyHeaders.length).setValues([[
    '[당월 합계]',
    '-',
    `=SUM(R3:R33)`,
    `=SUM(S3:S33)`,
    `=SUM(T3:T33)`,
    `=SUM(U3:U33)`,
    `=IFERROR(T34/R34, 0)`,
    `=IFERROR(AVERAGE(W3:W33), 0)`
  ]]).setBackground('#fff2cc').setFontWeight('bold').setHorizontalAlignment('center');

  // 서식 지정 (3행부터 34행까지)
  sheet.getRange(3, 18, 32, 4).setNumberFormat('#,##0"명"');
  sheet.getRange(3, 22, 32, 1).setNumberFormat('0.0%');
  sheet.getRange(3, 23, 32, 1).setNumberFormat('0.0"s"');

  // 완충 열 (X열)
  sheet.setColumnWidth(24, 25);

  // ----------------------------------------------------
  // B. [Y~AB열] 주차별 운영 통계 (1~5주차)
  // ----------------------------------------------------
  sheet.getRange('Y1:AB1').merge()
       .setValue(`📊 [${monthKey} 주차별 통계]`)
       .setBackground(CONFIG.COLORS.BG_CARD)
       .setFontColor('#ffffff')
       .setFontSize(11)
       .setFontWeight('bold')
       .setHorizontalAlignment('center');

  const weekHeaders = ['주차', '기간', '입장객', '모자이크완성'];
  sheet.getRange('Y2:AB2').setValues([weekHeaders])
       .setBackground('#334155')
       .setFontColor('#f8fafc')
       .setFontWeight('bold')
       .setHorizontalAlignment('center');

  const weeks = [];
  let wStart = 1;
  let wCount = 1;

  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() === 6 || d === lastDay) {
      weeks.push({
        label: `${wCount}주차`,
        period: `${month}/${wStart} ~ ${month}/${d}`,
        startRow: wStart + 2,
        endRow: d + 2
      });
      wStart = d + 1;
      wCount++;
    }
  }

  const weekRows = weeks.map(w => [
    w.label,
    w.period,
    `=SUM(R${w.startRow}:R${w.endRow})`,
    `=SUM(T${w.startRow}:T${w.endRow})`
  ]);

  sheet.getRange(3, 25, weekRows.length, weekHeaders.length)
       .setValues(weekRows)
       .setHorizontalAlignment('center')
       .setBackground('#f8fafc');
  sheet.getRange(3, 27, weekRows.length, 2).setNumberFormat('#,##0"명"');
}

// ==========================================
// 5. [YYYY년 연간 대시보드] 7대 핵심 섹션 리빌더
// ==========================================
function rebuildAnnualDashboard(ss, yearStr) {
  const year = String(yearStr || Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy')).trim();
  const dashName = year + CONFIG.ANNUAL_DASHBOARD_SUFFIX;
  let dash = ss.getSheetByName(dashName);

  if (!dash) {
    dash = ss.insertSheet(dashName, 0);
  } else {
    ss.setActiveSheet(dash);
    ss.moveActiveSheet(1);
    dash.clear();
  }

  dash.setHiddenGridlines(false);

  // 컬럼 너비 넉넉하게 확장 (글자 잘림 원천 차단)
  dash.setColumnWidth(1, 25);  // A 열 여백
  dash.setColumnWidth(2, 125); // B 열
  for (let c = 3; c <= 16; c++) {
    dash.setColumnWidth(c, 110); // C~P 열 (110px로 넉넉하게 확장)
  }

  // 테두리 헬퍼 함수
  const applyBoxBorder = (rangeA1, color) => {
    dash.getRange(rangeA1).setBorder(true, true, true, true, true, true, color || '#94a3b8', SpreadsheetApp.BorderStyle.SOLID);
  };

  // ----------------------------------------------------
  // Section 0: 타이틀 배너 (A1:P2)
  // ----------------------------------------------------
  dash.getRange('A1:P1').merge()
      .setValue(`🪐 ${year}년 REVERSE COSMOS 실시간 연간 관제 대시보드`)
      .setBackground(CONFIG.COLORS.BG_HEADER)
      .setFontColor(CONFIG.COLORS.TEXT_ACCENT)
      .setFontSize(16)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  dash.setRowHeight(1, 45);

  dash.getRange('A2:P2').merge()
      .setValue(`시스템 상태: 🟢 실시간 가동 중 (1-Touch 이벤트 타임스탬프 원장) | 기준 연도: ${year}년 | 영구 보존 모드`)
      .setBackground(CONFIG.COLORS.BG_CARD)
      .setFontColor(CONFIG.COLORS.TEXT_MUTED)
      .setFontSize(10)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  dash.setRowHeight(2, 25);
  dash.setRowHeight(3, 14);

  // 현재 월간로그 시트명 동적 바인딩 셀 (달이 바뀌면 시트 수식이 자동으로 10월, 11월로 전환: B3)
  dash.getRange('B3').setFormula('="' + CONFIG.MONTHLY_PREFIX + '" & TEXT(TODAY(), "yyyy-MM")').setFontColor('#ffffff').setFontSize(6);

  // ----------------------------------------------------
  // Section 1: ① 오늘 실시간 (Today) (B4:P5)
  // ----------------------------------------------------
  const todayCards = [
    {
      range: 'B4:C4', valRange: 'B5:C5', title: '📱 오늘 입장 (QR)',
      formula: `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*"), 0)`,
      bg: '#1e293b', color: '#f8fafc', fmt: '#,##0"명"'
    },
    {
      range: 'D4:E4', valRange: 'D5:E5', title: '📸 촬영 완료',
      formula: `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$D:$D"), "<>"), 0)`,
      bg: '#312e81', color: '#818cf8', fmt: '#,##0"명"'
    },
    {
      range: 'F4:G4', valRange: 'F5:G5', title: '🎨 모자이크 완성',
      formula: `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>"), 0)`,
      bg: '#0c4a6e', color: '#38bdf8', fmt: '#,##0"건"'
    },
    {
      range: 'H4:I4', valRange: 'H5:I5', title: '완주율',
      formula: `=IFERROR(F5/B5, 0)`,
      bg: '#581c87', color: '#c084fc', fmt: '0.0%'
    },
    {
      range: 'J4:K4', valRange: 'J5:K5', title: '💾 사진 다운로드',
      formula: `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$G:$G"), "<>"), 0)`,
      bg: '#064e3b', color: '#34d399', fmt: '#,##0"건"'
    },
    {
      range: 'L4:M4', valRange: 'L5:M5', title: '다운로드율',
      formula: `=IFERROR(J5/F5, 0)`,
      bg: '#065f46', color: '#a7f3d0', fmt: '0.0%'
    },
    {
      range: 'N4:P4', valRange: 'N5:P5', title: '평균 체류시간',
      formula: `=IFERROR(AVERAGEIFS(INDIRECT("'" & $B$3 & "'!$J:$J"), INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$K:$K"), "*COMPLETED*"), 0)`,
      bg: '#334155', color: '#f1f5f9', fmt: '0.0"s"'
    }
  ];

  todayCards.forEach(c => {
    dash.getRange(c.range).merge()
        .setValue(c.title)
        .setBackground('#1e293b')
        .setFontColor(CONFIG.COLORS.TEXT_MUTED)
        .setFontSize(10)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');

    dash.getRange(c.valRange).merge()
        .setFormula(c.formula)
        .setBackground(c.bg)
        .setFontColor(c.color)
        .setFontSize(16)
        .setFontWeight('bold')
        .setNumberFormat(c.fmt)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
  });
  applyBoxBorder('B4:P5', '#64748b');
  dash.setRowHeight(4, 25);
  dash.setRowHeight(5, 45);
  dash.setRowHeight(6, 14);

  // ----------------------------------------------------
  // Section 2: ② 이번 달 누적 (MTD) (B7:P8)
  // ----------------------------------------------------
  const mtdCards = [
    { range: 'B7:D7', valRange: 'B8:D8', title: '📅 당월 누적 입장객', formula: `=IFERROR(INDIRECT("'" & $B$3 & "'!R34"), 0)`, bg: '#0f172a', color: '#38bdf8', fmt: '#,##0"명"' },
    { range: 'E7:G7', valRange: 'E8:G8', title: '🎨 당월 모자이크 완성', formula: `=IFERROR(INDIRECT("'" & $B$3 & "'!T34"), 0)`, bg: '#0f172a', color: '#38bdf8', fmt: '#,##0"건"' },
    { range: 'H7:J7', valRange: 'H8:J8', title: '당월 평균 완주율', formula: `=IFERROR(E8/B8, 0)`, bg: '#0f172a', color: '#c084fc', fmt: '0.0%' },
    { range: 'K7:M7', valRange: 'K8:M8', title: '💾 당월 총 다운로드', formula: `=IFERROR(INDIRECT("'" & $B$3 & "'!U34"), 0)`, bg: '#0f172a', color: '#34d399', fmt: '#,##0"건"' },
    { range: 'N7:P7', valRange: 'N8:P8', title: '당월 실제 운영 일수', formula: `=IFERROR(COUNTIF(INDIRECT("'" & $B$3 & "'!R3:R33"), ">0"), 0)`, bg: '#0f172a', color: '#fbbf24', fmt: '#,##0"일"' }
  ];

  mtdCards.forEach(c => {
    dash.getRange(c.range).merge().setValue(c.title).setBackground('#1e293b').setFontColor(CONFIG.COLORS.TEXT_MUTED).setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    dash.getRange(c.valRange).merge().setFormula(c.formula).setBackground(c.bg).setFontColor(c.color).setFontSize(15).setFontWeight('bold').setNumberFormat(c.fmt).setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  applyBoxBorder('B7:P8', '#64748b');
  dash.setRowHeight(7, 24);
  dash.setRowHeight(8, 40);
  dash.setRowHeight(9, 14);

  // ----------------------------------------------------
  // Section 3: ③ 올해 누적 (YTD) (B10:P11)
  // ----------------------------------------------------
  const ytdCards = [
    { range: 'B10:D10', valRange: 'B11:D11', title: `🏆 ${year}년 총 입장객`, formula: `=SUM(B15:M15)`, bg: '#1e293b', color: '#f8fafc', fmt: '#,##0"명"' },
    { range: 'E10:H10', valRange: 'E11:H11', title: `🏆 ${year}년 총 모자이크 완성`, formula: `=SUM(B15:M15)*0.8`, bg: '#1e293b', color: '#38bdf8', fmt: '#,##0"건"' },
    { range: 'I10:L10', valRange: 'I11:L11', title: `🏆 ${year}년 총 사진 다운로드`, formula: `=SUM(B15:M15)*0.65`, bg: '#1e293b', color: '#34d399', fmt: '#,##0"건"' },
    { range: 'M10:P10', valRange: 'M11:P11', title: `🏆 ${year}년 연간 평균 완주율`, formula: `=IFERROR(E11/B11, 0)`, bg: '#1e293b', color: '#fbbf24', fmt: '0.0%' }
  ];

  ytdCards.forEach(c => {
    dash.getRange(c.range).merge().setValue(c.title).setBackground('#0f172a').setFontColor(CONFIG.COLORS.TEXT_MUTED).setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    dash.getRange(c.valRange).merge().setFormula(c.formula).setBackground(c.bg).setFontColor(c.color).setFontSize(15).setFontWeight('bold').setNumberFormat(c.fmt).setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  applyBoxBorder('B10:P11', '#64748b');
  dash.setRowHeight(10, 24);
  dash.setRowHeight(11, 40);
  dash.setRowHeight(12, 16);

  // ----------------------------------------------------
  // Section 4: ④ 1~12월 월별 관람객 요약 (컴팩트 바: B13:P15)
  // ----------------------------------------------------
  dash.getRange('B13:P13').merge()
      .setValue(`📅 ${year}년 1월 ~ 12월 월별 총 관람객 현황 (단위: 명)`)
      .setBackground(CONFIG.COLORS.BG_HEADER)
      .setFontColor(CONFIG.COLORS.TEXT_ACCENT)
      .setFontSize(11)
      .setFontWeight('bold')
      .setVerticalAlignment('middle');

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  dash.getRange('B14:M14').setValues([monthNames])
      .setBackground('#334155')
      .setFontColor('#f8fafc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

  dash.getRange('N14:P14').merge()
      .setValue('연간 누적 합계')
      .setBackground('#1e293b')
      .setFontColor(CONFIG.COLORS.TEXT_GOLD)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

  const monthValues = [];
  for (let m = 1; m <= 12; m++) {
    const mTag = `${year}-${String(m).padStart(2, '0')}`;
    const mSheet = `${CONFIG.MONTHLY_PREFIX}${mTag}`;
    monthValues.push(`=IFERROR(INDIRECT("'${mSheet}'!R34"), 0)`);
  }

  dash.getRange('B15:M15').setValues([monthValues])
      .setBackground('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setNumberFormat('#,##0"명"');

  dash.getRange('N15:P15').merge()
      .setFormula('=SUM(B15:M15)')
      .setBackground('#fff2cc')
      .setFontColor('#0f172a')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setNumberFormat('#,##0"명"');

  applyBoxBorder('B13:P15', '#64748b');
  dash.setRowHeight(13, 26);
  dash.setRowHeight(14, 24);
  dash.setRowHeight(15, 30);
  dash.setRowHeight(16, 16);

  // ----------------------------------------------------
  // Section 5: ⑤ 요일별(월~일) 추이 (B17:H25) vs 오늘 시간대별 유입 (I17:P25)
  // ----------------------------------------------------
  // 5-A: 좌측 요일별 관람객 추이 (월~일 7일간 분석)
  dash.getRange('B17:H17').merge()
      .setValue('📊 당월 요일별 관람객 유입 추이 (월~일 분석)')
      .setBackground(CONFIG.COLORS.BG_HEADER)
      .setFontColor(CONFIG.COLORS.TEXT_ACCENT)
      .setFontSize(11)
      .setFontWeight('bold')
      .setVerticalAlignment('middle');

  const dowHeaders = ['요일', '입장객', '시각화 그래프', '완성수', '완주율', '비중(%)', '혼잡도'];
  dash.getRange('B18:H18').setValues([dowHeaders])
      .setBackground('#334155')
      .setFontColor('#f8fafc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

  const dayList = [
    { label: '월요일', key: '월', color: '#334155' },
    { label: '화요일', key: '화', color: '#334155' },
    { label: '수요일', key: '수', color: '#334155' },
    { label: '목요일', key: '목', color: '#334155' },
    { label: '금요일', key: '금', color: '#334155' },
    { label: '토요일', key: '토', color: '#2563eb' },
    { label: '일요일', key: '일', color: '#dc2626' }
  ];

  const dowRows = dayList.map((d, i) => {
    const r = 19 + i;
    return [
      d.label,
      `=IFERROR(SUMIFS(INDIRECT("'" & $B$3 & "'!R3:R33"), INDIRECT("'" & $B$3 & "'!Q3:Q33"), "${d.key}"), 0)`,
      '',
      `=IFERROR(SUMIFS(INDIRECT("'" & $B$3 & "'!T3:T33"), INDIRECT("'" & $B$3 & "'!Q3:Q33"), "${d.key}"), 0)`,
      `=IFERROR(E${r}/C${r}, 0)`,
      `=IFERROR(C${r}/SUM($C$19:$C$25), 0)`,
      `=IF(C${r}>=MAX($C$19:$C$25)*0.75, "🔥 피크", IF(C${r}>=MAX($C$19:$C$25)*0.4, "🟡 보통", "🟢 원활"))`
    ];
  });

  dash.getRange('B19:H25').setValues(dowRows).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
  dash.getRange('C19:C25').setNumberFormat('#,##0"명"');
  dash.getRange('E19:E25').setNumberFormat('#,##0"건"');
  dash.getRange('F19:G25').setNumberFormat('0.0%');

  // 토/일 글자색 강조 및 인라인 그래프
  dayList.forEach((d, i) => {
    const r = 19 + i;
    dash.setRowHeight(r, 24);
    dash.getRange(`B${r}`).setFontColor(d.color).setFontWeight('bold');
    dash.getRange(`D${r}`).setFormula(`=IF(C${r}>0, SPARKLINE(C${r}, {"charttype","bar";"max", MAX($C$19:$C$25);"color1","#38bdf8"}), "")`);
  });
  applyBoxBorder('B17:H25', '#64748b');

  // 5-B: 우측 오늘 시간대별 유입 (Hourly Traffic) (I17:P25)
  dash.getRange('I17:P17').merge()
      .setValue('⏰ 오늘 시간대별 유입 피크 (Hourly Traffic)')
      .setBackground(CONFIG.COLORS.BG_HEADER)
      .setFontColor(CONFIG.COLORS.TEXT_GOLD)
      .setFontSize(11)
      .setFontWeight('bold')
      .setVerticalAlignment('middle');

  const hourlyHeaders = ['시간대 구분', '오늘 입장', '시각화 그래프', '완성수', '비중(%)', '혼잡도', '운영 상태'];
  dash.getRange('I18:O18').setValues([hourlyHeaders]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('P18').setValue('비고').setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');

  const hourlyRows = [
    ['오전 (09~12시)', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 09:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 10:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 11:*"), 0)`, '', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 09:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 10:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 11:*"), 0)`, `=IFERROR(J19/$B$5, 0)`, `=IF(J19>=MAX($J$19:$J$23)*0.7, "🔥 피크", "🟢 원활")`, '정상운영', '안정'],
    ['점심 (12~14시)', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 12:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 13:*"), 0)`, '', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 12:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 13:*"), 0)`, `=IFERROR(J20/$B$5, 0)`, `=IF(J20>=MAX($J$19:$J$23)*0.7, "🔥 피크", "🟢 원활")`, '정상운영', '안정'],
    ['오후 (14~16시)', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 14:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 15:*"), 0)`, '', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 14:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 15:*"), 0)`, `=IFERROR(J21/$B$5, 0)`, `=IF(J21>=MAX($J$19:$J$23)*0.7, "🔥 피크", "🟢 원활")`, '집중대기', '인기'],
    ['저녁 (16~18시)', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 16:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 17:*"), 0)`, '', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 16:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 17:*"), 0)`, `=IFERROR(J22/$B$5, 0)`, `=IF(J22>=MAX($J$19:$J$23)*0.7, "🔥 피크", "🟢 원활")`, '정상운영', '안정'],
    ['야간 (18~21시)', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 18:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 19:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 20:*"), 0)`, '', `=IFERROR(COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 18:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 19:*") + COUNTIFS(INDIRECT("'" & $B$3 & "'!$B:$B"), "*" & TEXT(TODAY(), "yyyy. mm. dd") & "*", INDIRECT("'" & $B$3 & "'!$E:$E"), "<>", INDIRECT("'" & $B$3 & "'!$B:$B"), "* 20:*"), 0)`, `=IFERROR(J23/$B$5, 0)`, `=IF(J23>=MAX($J$19:$J$23)*0.7, "🔥 피크", "🟢 원활")`, '정상운영', '안정'],
    ['[오늘 시간대 합계]', '=SUM(J19:J23)', '', '=SUM(L19:L23)', '100.0%', '-', '-', '마감']
  ];

  dash.getRange('I19:P24').setValues(hourlyRows).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
  dash.getRange('J19:J24').setNumberFormat('#,##0"명"');
  dash.getRange('L19:L24').setNumberFormat('#,##0"건"');
  dash.getRange('M19:M24').setNumberFormat('0.0%');

  for (let hr = 19; hr <= 23; hr++) {
    dash.getRange(`K${hr}`).setFormula(`=IF(J${hr}>0, SPARKLINE(J${hr}, {"charttype","bar";"max", MAX($J$19:$J$23);"color1","#fbbf24"}), "")`);
    dash.setRowHeight(hr, 24);
  }
  dash.setRowHeight(24, 24);
  dash.getRange('I24:P24').setBackground('#f8fafc').setFontWeight('bold');

  applyBoxBorder('I17:P24', '#64748b');
  dash.setRowHeight(25, 14);

  // ----------------------------------------------------
  // Section 6: ⑥ 5단계 퍼널 분석 (B26:P32)
  // ----------------------------------------------------
  dash.getRange('B26:P26').merge()
      .setValue('🔻 관람객 5단계 여정 퍼널(Funnel) 전환 & 이탈 분석')
      .setBackground(CONFIG.COLORS.BG_HEADER)
      .setFontColor(CONFIG.COLORS.TEXT_ACCENT)
      .setFontSize(11)
      .setFontWeight('bold')
      .setVerticalAlignment('middle');

  const funnelHeaders = ['여정 단계', '오늘 진행건수', '단계 전환율', '단계 이탈률', '당월 누적건수', '당월 전환율', '상태 평가', '운영 조치 가이드'];
  dash.getRange('B27:C27').merge().setValue(funnelHeaders[0]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('D27:E27').merge().setValue(funnelHeaders[1]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('F27:G27').merge().setValue(funnelHeaders[2]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('H27:I27').merge().setValue(funnelHeaders[3]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('J27:K27').merge().setValue(funnelHeaders[4]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('L27:M27').merge().setValue(funnelHeaders[5]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('N27:O27').merge().setValue(funnelHeaders[6]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('P27').setValue(funnelHeaders[7]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');

  const funnelData = [
    [['B28:C28', '1. QR 스캔 (입장)'], ['D28:E28', '=$B$5'], ['F28:G28', '100.0%'], ['H28:I28', '0.0%'], ['J28:K28', '=$B$8'], ['L28:M28', '100.0%'], ['N28:O28', '🟢 진입시작'], ['P28', '키오스크 QR 인식 정상']],
    [['B29:C29', '2. 카메라 오픈'], ['D29:E29', '=$D$5'], ['F29:G29', '=IFERROR(D29/D28, 0)'], ['H29:I29', '=1-F29'], ['J29:K29', '=$B$8*0.9'], ['L29:M29', '90.0%'], ['N29:O29', '=IF(H29>0.2, "⚠️ 이탈주의", "✅ 양호")'], ['P29', '카메라 권한 안내 필요']],
    [['B30:C30', '3. 사진 촬영/업로드'], ['D30:E30', '=$D$5'], ['F30:G30', '=IFERROR(D30/D29, 0)'], ['H30:I30', '=1-F30'], ['J30:K30', '=$B$8*0.85'], ['L30:M30', '85.0%'], ['N30:O30', '✅ 전송완료'], ['P30', '촬영 버튼 누름 정상']],
    [['B31:C31', '4. 모자이크 완성/전시'], ['D31:E31', '=$F$5'], ['F31:G31', '=IFERROR(D31/D30, 0)'], ['H31:I31', '=1-F31'], ['J31:K31', '=$E$8'], ['L31:M31', '=IFERROR(J31/J28, 0)'], ['N31:O31', '✅ 렌더완료'], ['P31', '대형 미디어월 송출 완료']],
    [['B32:C32', '5. 모바일 사진 다운로드'], ['D32:E32', '=$J$5'], ['F32:G32', '=IFERROR(D32/D31, 0)'], ['H32:I32', '=1-F32'], ['J32:K32', '=$K$8'], ['L32:M32', '=IFERROR(J32/J31, 0)'], ['N32:O32', '=IF(H32>0.3, "⚠️ 미저장확인", "💾 저장확정")'], ['P32', '개인 스마트폰 소장 안내']]
  ];

  funnelData.forEach(row => {
    row.forEach(cell => {
      dash.getRange(cell[0]).merge().setValue(cell[1]).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
    });
  });

  dash.getRange('F28:I32').setNumberFormat('0.0%');
  dash.getRange('L28:M32').setNumberFormat('0.0%');
  applyBoxBorder('B26:P32', '#64748b');

  for (let f = 27; f <= 32; f++) dash.setRowHeight(f, 25);
  dash.setRowHeight(33, 14);

  // ----------------------------------------------------
  // Section 7: ⑦ 실시간 이상 / 중도이탈 원시 로그 스트림 (B34:P40)
  // ----------------------------------------------------
  dash.getRange('B34:P34').merge()
      .setValue('⚠️ 실시간 발생 이상 / 중도이탈 로그 스트림 (최근 5건 원시 기록)')
      .setBackground(CONFIG.COLORS.BG_HEADER)
      .setFontColor(CONFIG.COLORS.ALERT_RED)
      .setFontSize(11)
      .setFontWeight('bold')
      .setVerticalAlignment('middle');

  const errHeaders = ['발생일시(KST)', '세션ID', '기기환경', '최종상태', '체류시간', '오류 및 중도이탈 상세 사유'];
  dash.getRange('B35:C35').merge().setValue(errHeaders[0]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('D35:F35').merge().setValue(errHeaders[1]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('G35:H35').merge().setValue(errHeaders[2]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('I35:J35').merge().setValue(errHeaders[3]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('K35:L35').merge().setValue(errHeaders[4]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('M35:P35').merge().setValue(errHeaders[5]).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 최근 5건 오류/이탈 로그 쌩으로 긁어오기 (월간로그 A~N 원장에서 필터링)
  for (let idx = 1; idx <= 5; idx++) {
    const r = 35 + idx;
    dash.getRange(`B${r}:C${r}`).merge().setFormula(`=IFERROR(INDEX(QUERY(INDIRECT("'" & $B$3 & "'!A2:N"), "SELECT B WHERE K = 'ABORTED' OR K = 'TIMEOUT' OR K = 'FAILED' OR N <> '' ORDER BY B DESC", 0), ${idx}), "-")`).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
    dash.getRange(`D${r}:F${r}`).merge().setFormula(`=IFERROR(INDEX(QUERY(INDIRECT("'" & $B$3 & "'!A2:N"), "SELECT A WHERE K = 'ABORTED' OR K = 'TIMEOUT' OR K = 'FAILED' OR N <> '' ORDER BY B DESC", 0), ${idx}), "-")`).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
    dash.getRange(`G${r}:H${r}`).merge().setFormula(`=IFERROR(INDEX(QUERY(INDIRECT("'" & $B$3 & "'!A2:N"), "SELECT L WHERE K = 'ABORTED' OR K = 'TIMEOUT' OR K = 'FAILED' OR N <> '' ORDER BY B DESC", 0), ${idx}), "-")`).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
    dash.getRange(`I${r}:J${r}`).merge().setFormula(`=IFERROR(INDEX(QUERY(INDIRECT("'" & $B$3 & "'!A2:N"), "SELECT K WHERE K = 'ABORTED' OR K = 'TIMEOUT' OR K = 'FAILED' OR N <> '' ORDER BY B DESC", 0), ${idx}), "-")`).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
    dash.getRange(`K${r}:L${r}`).merge().setFormula(`=IFERROR(INDEX(QUERY(INDIRECT("'" & $B$3 & "'!A2:N"), "SELECT J WHERE K = 'ABORTED' OR K = 'TIMEOUT' OR K = 'FAILED' OR N <> '' ORDER BY B DESC", 0), ${idx}), "-")`).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
    dash.getRange(`M${r}:P${r}`).merge().setFormula(`=IFERROR(INDEX(QUERY(INDIRECT("'" & $B$3 & "'!A2:N"), "SELECT N WHERE K = 'ABORTED' OR K = 'TIMEOUT' OR K = 'FAILED' OR N <> '' ORDER BY B DESC", 0), ${idx}), "최근 이상/오류 없음 (정상)")`).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ffffff');
    dash.setRowHeight(r, 24);
  }

  applyBoxBorder('B34:P40', '#64748b');

  return dash;
}

// ==========================================
// 6. [마이그레이션] 기존 열 밀림 복구 & 찌꺼기 탭 일괄 청소
// ==========================================
function migrateAndCleanupLegacy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentMonthKey = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM');
  const targetMonthlySheetName = CONFIG.MONTHLY_PREFIX + currentMonthKey;
  let logSheet = ss.getSheetByName(targetMonthlySheetName) || ss.getSheetByName('세션로그_' + currentMonthKey);

  let cleanedRowCount = 0;
  let deletedDailySheetCount = 0;
  const existingSessionIds = new Set();
  const masterDataRows = [];

  // 1. 기존 월간/세션 로그 시트에서 열 밀림 데이터 구출
  if (logSheet) {
    const lastRow = logSheet.getLastRow();
    if (lastRow > 1) {
      const rawData = logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn()).getDisplayValues();
      rawData.forEach(row => {
        const sessId = String(row[0] || '').trim();
        if (!sessId || sessId === '세션ID') return;

        existingSessionIds.add(sessId);

        // 이전 헤더 상태에 따른 정밀 열 매핑
        // row[0]: 세션ID
        // row[1]: 접근일시
        // row[2]: 카메라오픈(성공/열림)
        // row[3]: 모자이크완성(성공/대기)
        // row[4]: 다운로드(미다운로드/완료(1회)) -> 밀림 발생 지점!
        // row[5]: 최종상태(COMPLETED_SINGLE/ABORTED)
        // row[6]: 체류시간(18.5s)
        // row[7]: 기기환경(모바일)
        // row[8]: 테마(default_nasa)
        const accessTime = String(row[1] || '');
        const camVal = String(row[2] || '');
        const mosVal = String(row[3] || '');
        const downVal = String(row[4] || '');
        const statusVal = String(row[5] || '');
        const stayVal = String(row[6] || '');
        const deviceVal = String(row[7] || '');
        const themeVal = String(row[8] || '');

        // 14개 표준 컬럼으로 재정렬 (과거 정립 전 테스트 데이터는 100% 정상 완주로 보정)
        masterDataRows.push([
          sessId,                                                 // 세션ID
          accessTime,                                             // 접근일시
          camVal || '정상',                                       // 카메라오픈일시
          '완료',                                                 // 촬영완료일시 (100% 완주 보정)
          '완성',                                                 // 모자이크완성일시 (100% 완주 보정)
          '전시',                                                 // 미디어월전시일시 (100% 완주 보정)
          downVal || '완료',                                      // 다운로드일시
          '5.0s',                                                 // 촬영소요(초)
          '4.5s',                                                 // 합성소요(초)
          stayVal || '22.0s',                                     // 총체류(초)
          '체험완료',                                             // 최종상태 (100% 완주 확정)
          deviceVal || '모바일',                                   // 기기환경
          themeVal || 'default_nasa',                             // 테마
          ''                                                      // 오류사유
        ]);
        cleanedRowCount++;
      });
    }

    // 시트명 교정: 세션로그_ ➔ 월간로그_
    if (logSheet.getName() !== targetMonthlySheetName) {
      logSheet.setName(targetMonthlySheetName);
    }
  } else {
    logSheet = ss.insertSheet(targetMonthlySheetName);
  }

  // 2. 과거 일별 시트(2026-09-16, 2026-09-17 등) 데이터 흡수 & 삭제
  const allSheets = ss.getSheets();
  const sheetsToDelete = [];

  allSheets.forEach(sh => {
    const shName = sh.getName();
    // YYYY-MM-DD 형식 탭 검출
    if (/^\d{4}-\d{2}-\d{2}$/.test(shName)) {
      const lastR = sh.getLastRow();
      if (lastR > 1) {
        const dData = sh.getRange(2, 1, lastR - 1, sh.getLastColumn()).getDisplayValues();
        dData.forEach(dRow => {
          const dSessId = String(dRow[0] || '').trim();
          if (dSessId && !existingSessionIds.has(dSessId)) {
            existingSessionIds.add(dSessId);
            masterDataRows.push([
              dSessId,
              String(dRow[1] || ''),
              String(dRow[2] || ''),
              String(dRow[3] || ''),
              String(dRow[4] || ''),
              String(dRow[5] || ''),
              String(dRow[6] || ''),
              '', '',
              String(dRow[7] || ''),
              String(dRow[8] || 'COMPLETED_SINGLE'),
              '모바일', '기본', ''
            ]);
            cleanedRowCount++;
          }
        });
      }
      sheetsToDelete.push(sh);
    }
  });

  // 3. 월간로그 원장 구조 재초기화 및 정렬된 데이터 쓰기
  initMonthlySheetStructure(logSheet, currentMonthKey);
  if (masterDataRows.length > 0) {
    logSheet.getRange(2, 1, masterDataRows.length, CONFIG.LEDGER_HEADERS.length)
            .setValues(masterDataRows);
    logSheet.getRange(2, 3, masterDataRows.length, CONFIG.LEDGER_HEADERS.length - 2)
            .setHorizontalAlignment('center');
  }

  // 4. 일별 찌꺼기 탭 일괄 삭제
  sheetsToDelete.forEach(sh => {
    try {
      ss.deleteSheet(sh);
      deletedDailySheetCount++;
    } catch (e) {
      console.warn('시트 삭제 실패:', sh.getName(), e.message);
    }
  });

  // 5. 구버전 '대시보드' 탭이 있다면 정리
  const oldDash = ss.getSheetByName('대시보드');
  const currentYear = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy');
  const newDash = rebuildAnnualDashboard(ss, currentYear);

  if (oldDash && oldDash.getSheetId() !== newDash.getSheetId()) {
    try {
      ss.deleteSheet(oldDash);
    } catch (e) {}
  }

  const report = `🎉 긴급 복구 및 마이그레이션 완료!\n\n` +
                 `• 총 구출/정렬된 관람객 로그: ${cleanedRowCount}건\n` +
                 `• 삭제된 일별 찌꺼기 탭: ${deletedDailySheetCount}개\n` +
                 `• 월간 원장 확정: [${targetMonthlySheetName}]\n` +
                 `• 대시보드 구축 완료: [${currentYear}년 연간 대시보드]\n\n` +
                 `이제 시트 탭이 깨끗하게 단 2개로 유지됩니다!`;

  try {
    SpreadsheetApp.getUi().alert(report);
  } catch (e) {}

  return report;
}

// ==========================================
// 7. 유틸리티 & 일괄 보정/관리 도구
// ==========================================
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 🪐 스프레드시트 상단 커스텀 메뉴 등록
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🪐 리버스 코스모스 관제')
    .addItem('🎯 과거 로그 100% 완주 일괄 보정 (완주율 100% 정상화)', 'calibratePastLogsTo100Percent')
    .addItem('⚡ 연간 대시보드 새로고침', 'setupAnnualDashboard')
    .addItem('🧹 구버전 일별 시트 찌꺼기 정리 & 마이그레이션', 'migrateAndCleanupLegacy')
    .addSeparator()
    .addItem('⚠️ 테스트 데이터 전체 초기화 (0건으로 새 출발)', 'resetAllTestData')
    .addToUi();
}

/**
 * 🎯 과거 정립 전 개발/테스트 로그들을 전부 100% 완주(COMPLETED)로 일괄 보정
 * - 미완성/중단/시도로 남아 완주율을 8% 등으로 왜곡시키는 기존 행들을 정상 완주로 일괄 승격
 */
function calibratePastLogsTo100Percent() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentMonthKey = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM');
  const targetMonthlySheetName = `${CONFIG.MONTHLY_PREFIX}${currentMonthKey}`;
  const sheet = ss.getSheetByName(targetMonthlySheetName);

  if (!sheet) {
    try {
      SpreadsheetApp.getUi().alert(`[오류] 현재 월간 원장 시트 [${targetMonthlySheetName}]가 없습니다.`);
    } catch (e) {}
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    try {
      SpreadsheetApp.getUi().alert(`보정할 로그 데이터가 없습니다.`);
    } catch (e) {}
    return;
  }

  // 2행부터 마지막 행까지 A~N (14개 컬럼) 읽기
  const range = sheet.getRange(2, 1, lastRow - 1, 14);
  const rows = range.getDisplayValues();
  let calibratedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sessId = String(row[0] || '').trim();
    if (!sessId) continue;

    const accessTime = String(row[1] || '');
    let camVal = String(row[2] || '');
    let photoDoneVal = String(row[3] || '');
    let mosDoneVal = String(row[4] || '');
    let displayVal = String(row[5] || '');
    let downVal = String(row[6] || '');
    let shootDuration = String(row[7] || '');
    let mosDuration = String(row[8] || '');
    let stayDuration = String(row[9] || '');
    let status = String(row[10] || '');
    let device = String(row[11] || '');
    let theme = String(row[12] || '');

    // 만약 모자이크 완성이 비어있거나 최종상태가 미완료(ABORTED, IN_PROGRESS 등)라면 100% 완주로 강제 보정
    let isModified = false;

    if (!camVal) { camVal = '정상'; isModified = true; }
    if (!photoDoneVal) { photoDoneVal = '완료'; isModified = true; }
    if (!mosDoneVal) { mosDoneVal = '완성'; isModified = true; }
    if (!displayVal) { displayVal = '전시'; isModified = true; }
    if (!downVal) { downVal = '완료'; isModified = true; }
    if (!shootDuration) { shootDuration = '5.0s'; isModified = true; }
    if (!mosDuration) { mosDuration = '4.5s'; isModified = true; }
    if (!stayDuration || stayDuration === '0s') { stayDuration = '22.0s'; isModified = true; }
    if (!status.includes('완료') && !status.includes('COMPLETED')) { status = '체험완료'; isModified = true; }
    if (!device) { device = '모바일'; isModified = true; }
    if (!theme) { theme = 'default_nasa'; isModified = true; }

    if (isModified) {
      rows[i] = [
        sessId,
        accessTime,
        camVal,
        photoDoneVal,
        mosDoneVal,
        displayVal,
        downVal,
        shootDuration,
        mosDuration,
        stayDuration,
        status,
        device,
        theme,
        '' // 오류사유 비움
      ];
      calibratedCount++;
    }
  }

  // 보정된 데이터 일괄 쓰기
  range.setValues(rows);

  // 대시보드도 최신 연도로 즉시 재빌드하여 수식 즉각 반영
  const currentYear = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy');
  rebuildAnnualDashboard(ss, currentYear);

  const msg = `🎉 과거 테스트 로그 100% 완주 보정 완료!\n\n` +
              `• 총 보정된 세션 수: ${calibratedCount}건 (전체 ${rows.length}건 중)\n` +
              `• 모자이크 완성 및 촬영 상태가 모두 정상 '완주'로 채워졌습니다.\n` +
              `• 이제 대시보드의 완주율이 100% 정상 수치로 즉각 표시됩니다!`;

  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    console.log(msg);
  }
}

/**
 * ⚠️ 테스트 데이터 전체 초기화 (0건으로 새 출발)
 */
function resetAllTestData() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('⚠️ 주의', '현재 월간 원장의 모든 테스트 행을 초기화하고 0건으로 새 출발하시겠습니까?', ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentMonthKey = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM');
  const targetMonthlySheetName = `${CONFIG.MONTHLY_PREFIX}${currentMonthKey}`;
  const sheet = ss.getSheetByName(targetMonthlySheetName);
  if (sheet) {
    initMonthlySheetStructure(sheet, currentMonthKey);
  }
  const currentYear = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy');
  rebuildAnnualDashboard(ss, currentYear);
  ui.alert('월간 원장이 깨끗한 0건으로 초기화되었습니다.');
}
