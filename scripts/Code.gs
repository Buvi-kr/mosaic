/**
 * 🪐 REVERSE COSMOS MOSAIC - Google Sheets 올인원 고도화 관제 엔진 (Code.gs)
 * 
 * [시트 구성 (단 2개 탭으로 완전 통합)]
 * 1. "대시보드"       : [첫 페이지] 오늘 실시간 KPI 카드 + 퍼널 전환율 분석 + 시간대별 피크타임(SPARKLINE 바차트) + 최근 일자별 일일 성과 캘린더
 * 2. "세션로그_YYYY-MM": [상세 로그] 월별 자동 분할되는 관람객 1인 1행 실시간 세션 여정 (입장~다운로드)
 * 
 * [보안 안내]
 * - 이 스크립트는 시트에 종속된 컨테이너 바인딩 스크립트로, 코드 내에 시트 주소나 비밀키가 전혀 들어가지 않습니다.
 * - 배포된 Web App URL은 로컬의 .env 또는 data/config.local.json에만 안전하게 보관됩니다.
 * 
 * [배포 방법]
 * 1. 구글 시트 상단 [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 모두 지우고 이 스크립트 전체를 붙여넣은 뒤 저장 (Ctrl+S)
 * 3. [배포] > [배포 관리] > 연필 아이콘(편집) > 버전에서 [새 버전] 선택 > [배포] 클릭!
 *    (이렇게 하시면 기존에 발급된 Web App URL이 그대로 유지됩니다)
 */

var DASHBOARD_SHEET_NAME = '대시보드';

var SESSION_HEADERS = [
  '세션ID', '접근일시(KST)', '1차촬영', '1차모자이크', '추가촬영',
  '2차모자이크', '다운로드', '최종상태', '체류시간', '기기환경', '테마'
];

// GET 헬스체크
function doGet(e) {
  return jsonResponse({
    ok: true,
    service: 'Reverse Cosmos Mosaic Advanced Monitoring',
    status: 'ONLINE',
    timestamp: new Date().toISOString()
  });
}

// POST 데이터 수신
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 동시성 충돌 방지 (최대 10초)
  } catch (lockErr) {
    return jsonResponse({ ok: false, error: 'Lock timeout' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Empty payload' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var data = payload.data || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'sessionRow') {
      upsertSessionRow(ss, data);
    } else if (action === 'summary') {
      handleSummarySync(ss, data);
    } else {
      return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
    }

    return jsonResponse({ ok: true, action: action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.stack || err) });
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 1. 세션 여정 실시간 기록 (월별 탭 자동 분할)
// ==========================================
function upsertSessionRow(ss, data) {
  var sessionId = data['세션ID'];
  if (!sessionId) throw new Error('세션ID 누락');

  var monthKey = data.monthKey || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  var sheetName = '세션로그_' + monthKey;

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(SESSION_HEADERS);
    sheet.setFrozenRows(1);
    
    sheet.getRange(1, 1, 1, SESSION_HEADERS.length)
         .setBackground('#1e293b')
         .setFontColor('#f8fafc')
         .setFontWeight('bold')
         .setHorizontalAlignment('center');
         
    sheet.setColumnWidth(1, 190);
    sheet.setColumnWidth(2, 170);
    sheet.setColumnWidth(8, 140);
    ensureDashboardFirst(ss);
  }

  var values = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(sessionId)) {
      targetRow = i + 1;
      break;
    }
  }

  var rowValues = SESSION_HEADERS.map(function(h) {
    return data[h] !== undefined ? data[h] : '';
  });

  if (targetRow === -1) {
    sheet.appendRow(rowValues);
    targetRow = sheet.getLastRow();
  } else {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  }

  sheet.getRange(targetRow, 3, 1, rowValues.length - 2).setHorizontalAlignment('center');

  // 첫 세션 추가 또는 상태 완료 시 대시보드 함께 갱신
  var status = String(data['최종상태'] || '');
  if (targetRow === sheet.getLastRow() || status.indexOf('COMPLETED') !== -1) {
    renderAdvancedDashboard(ss, data);
  }
}

// ==========================================
// 2. 10분 주기 요약 동기화
// ==========================================
function handleSummarySync(ss, data) {
  renderAdvancedDashboard(ss, data);
}

// ==========================================
// 3. 고도화된 올인원 대시보드 렌더링 엔진
// ==========================================
function renderAdvancedDashboard(ss, data) {
  var dash = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (!dash) {
    dash = ss.insertSheet(DASHBOARD_SHEET_NAME, 0);
  } else {
    ensureDashboardFirst(ss);
  }

  dash.setHiddenGridlines(false);

  var now = new Date();
  var nowKst = data['시각(KST)'] || Utilities.formatDate(now, 'Asia/Seoul', 'yyyy. MM. dd HH:mm:ss');
  var todayStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy. MM. dd');
  var monthStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM');

  // 당월 세션 로그 데이터 파싱
  var analytics = analyzeMonthlyLog(ss, '세션로그_' + monthStr, todayStr);

  // ----------------------------------------------------
  // A. 상단 타이틀 배너 (A1:N2)
  // ----------------------------------------------------
  dash.getRange('A1:N1').merge()
      .setValue('🪐 REVERSE COSMOS MOSAIC 전시장 실시간 관제 대시보드')
      .setBackground('#0f172a')
      .setFontColor('#38bdf8')
      .setFontSize(16)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  dash.setRowHeight(1, 45);

  var totalAllTime = data['총참여자'] ? data['총참여자'] + '명' : analytics.monthTotal + '명';
  dash.getRange('A2:N2').merge()
      .setValue('최종 갱신: ' + nowKst + ' | 시스템 상태: 🟢 실시간 정상 가동 중 (ONLINE) | 전시 전체 누적: ' + totalAllTime)
      .setBackground('#1e293b')
      .setFontColor('#94a3b8')
      .setFontSize(10)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  dash.setRowHeight(2, 25);
  dash.setRowHeight(3, 14);

  // ----------------------------------------------------
  // B. 오늘의 실시간 현황 (Today's Live KPI Cards) (B4:N5)
  // ----------------------------------------------------
  var t = analytics.today;
  var kpiCards = [
    { range: 'B4:C4', valRange: 'B5:C5', title: '오늘 입장객', val: t.total + '명', color: '#f8fafc', bg: '#1e293b' },
    { range: 'D4:E4', valRange: 'D5:E5', title: '오늘 완주', val: t.completed + '건', color: '#38bdf8', bg: '#0c4a6e' },
    { range: 'F4:G4', valRange: 'F5:G5', title: '완주율 (퍼널)', val: t.completionRate, color: '#c084fc', bg: '#581c87' },
    { range: 'H4:I4', valRange: 'H5:I5', title: '📸 1차 촬영율', val: t.captureRate, color: '#818cf8', bg: '#312e81' },
    { range: 'J4:K4', valRange: 'J5:K5', title: '🔁 추가촬영(2차)', val: t.retryRate, color: '#fbbf24', bg: '#78350f' },
    { range: 'L4:M4', valRange: 'L5:M5', title: '💾 다운로드율', val: t.downloadRate, color: '#34d399', bg: '#064e3b' },
    { range: 'N4:N4', valRange: 'N5:N5', title: '평균 체류', val: t.avgStay, color: '#f1f5f9', bg: '#334155' }
  ];

  kpiCards.forEach(function(c) {
    dash.getRange(c.range).merge()
        .setValue(c.title)
        .setBackground('#1e293b')
        .setFontColor('#94a3b8')
        .setFontSize(10)
        .setFontWeight('bold')
        .setHorizontalAlignment('center');

    dash.getRange(c.valRange).merge()
        .setValue(c.val)
        .setBackground(c.bg)
        .setFontColor(c.color)
        .setFontSize(18)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
  });
  dash.setRowHeight(4, 25);
  dash.setRowHeight(5, 45);
  dash.setRowHeight(6, 18);

  // ----------------------------------------------------
  // C. 좌측: 관람객 퍼널 단계별 전환율 분석 (B7:G13)
  // ----------------------------------------------------
  dash.getRange('B7:G7').merge()
      .setValue('🔻 오늘 관람객 퍼널(Funnel) 단계별 전환율 & 이탈 분석')
      .setBackground('#0f172a')
      .setFontColor('#38bdf8')
      .setFontSize(11)
      .setFontWeight('bold');

  var funnelHeaders = ['단계', '진행 건수', '전체 대비 비율', '직전 단계 전환율', '이탈률', '평가'];
  dash.getRange('B8:G8').setValues([funnelHeaders])
      .setBackground('#334155')
      .setFontColor('#f8fafc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

  var capDrop = t.total > 0 ? ((t.total - t.capture1) / t.total * 100).toFixed(1) + '%' : '0.0%';
  var mosDrop = t.capture1 > 0 ? ((t.capture1 - t.completed) / t.capture1 * 100).toFixed(1) + '%' : '0.0%';
  var downDrop = t.completed > 0 ? ((t.completed - t.download) / t.completed * 100).toFixed(1) + '%' : '0.0%';

  var funnelData = [
    ['1. 스마트 QR 입장', t.total + '명', '100.0%', '100.0%', '0.0%', '🟢 시작'],
    ['2. 1차 셀카 촬영', t.capture1 + '명', t.captureRate, t.captureRate, capDrop, parseFloat(capDrop) > 15 ? '⚠️ 이탈주의' : '✅ 양호'],
    ['3. 모자이크 완성', t.completed + '건', t.completionRate, t.capture1 > 0 ? ((t.completed / t.capture1)*100).toFixed(1)+'%' : '0%', mosDrop, '✅ 렌더완료'],
    ['4. 2차 추가촬영 선택', t.retry + '건', t.retryRate, t.completed > 0 ? ((t.retry / t.completed)*100).toFixed(1)+'%' : '0%', '-', '🔁 보너스컷'],
    ['5. 최종 사진 다운로드', t.download + '건', t.downloadRate, t.completed > 0 ? ((t.download / t.completed)*100).toFixed(1)+'%' : '0%', downDrop, parseFloat(downDrop) > 30 ? '⚠️ 미저장확인' : '💾 저장확정']
  ];

  dash.getRange('B9:G13').setValues(funnelData).setHorizontalAlignment('center').setBackground('#f8fafc');
  dash.getRange('B9:B13').setFontWeight('bold').setBackground('#f1f5f9');
  for (var r = 8; r <= 13; r++) dash.setRowHeight(r, 25);

  // ----------------------------------------------------
  // D. 우측: 오늘 시간대별 유입 피크 (I7:N13)
  // ----------------------------------------------------
  dash.getRange('I7:N7').merge()
      .setValue('⏰ 오늘 시간대별 관람객 유입 피크타임 (Hourly Traffic)')
      .setBackground('#0f172a')
      .setFontColor('#fbbf24')
      .setFontSize(11)
      .setFontWeight('bold');

  var hourlyHeaders = ['시간대 구분', '입장객', '시각화 그래프', '완주수', '비중(%)', '혼잡도'];
  dash.getRange('I8:N8').setValues([hourlyHeaders])
      .setBackground('#334155')
      .setFontColor('#f8fafc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

  var h = analytics.hourly;
  var maxH = Math.max(h.m9_12, h.m12_14, h.m14_16, h.m16_18, h.m18_21, 1);

  var hourlyData = [
    ['오전 (09:00~12:00)', h.m9_12 + '명', '', h.c9_12 + '건', t.total > 0 ? ((h.m9_12/t.total)*100).toFixed(1)+'%' : '0%', getTrafficTag(h.m9_12, maxH)],
    ['점심 (12:00~14:00)', h.m12_14 + '명', '', h.c12_14 + '건', t.total > 0 ? ((h.m12_14/t.total)*100).toFixed(1)+'%' : '0%', getTrafficTag(h.m12_14, maxH)],
    ['오후 피크 (14:00~16:00)', h.m14_16 + '명', '', h.c14_16 + '건', t.total > 0 ? ((h.m14_16/t.total)*100).toFixed(1)+'%' : '0%', getTrafficTag(h.m14_16, maxH)],
    ['저녁 (16:00~18:00)', h.m16_18 + '명', '', h.c16_18 + '건', t.total > 0 ? ((h.m16_18/t.total)*100).toFixed(1)+'%' : '0%', getTrafficTag(h.m16_18, maxH)],
    ['야간 (18:00~21:00)', h.m18_21 + '명', '', h.c18_21 + '건', t.total > 0 ? ((h.m18_21/t.total)*100).toFixed(1)+'%' : '0%', getTrafficTag(h.m18_21, maxH)]
  ];

  dash.getRange('I9:N13').setValues(hourlyData).setHorizontalAlignment('center').setBackground('#f8fafc');
  dash.getRange('I9:I13').setFontWeight('bold').setBackground('#f1f5f9');

  // SPARKLINE 인라인 막대그래프 셀 수식 주입 (K열: 인라인 바 차트)
  dash.getRange('K9').setFormula('=SPARKLINE(' + h.m9_12 + ', {"charttype","bar";"max",' + maxH + ';"color1","#38bdf8"})');
  dash.getRange('K10').setFormula('=SPARKLINE(' + h.m12_14 + ', {"charttype","bar";"max",' + maxH + ';"color1","#38bdf8"})');
  dash.getRange('K11').setFormula('=SPARKLINE(' + h.m14_16 + ', {"charttype","bar";"max",' + maxH + ';"color1","#f43f5e"})'); // 피크는 로즈 레드
  dash.getRange('K12').setFormula('=SPARKLINE(' + h.m16_18 + ', {"charttype","bar";"max",' + maxH + ';"color1","#38bdf8"})');
  dash.getRange('K13').setFormula('=SPARKLINE(' + h.m18_21 + ', {"charttype","bar";"max",' + maxH + ';"color1","#38bdf8"})');

  dash.setRowHeight(14, 20);

  // ----------------------------------------------------
  // E. 하단: 최근 일자별 일일 통계 캘린더 (Daily Performance Report) (B15:N30)
  // ----------------------------------------------------
  dash.getRange('B15:N15').merge()
      .setValue('📅 최근 일자별 일일 성과 리포트 (Daily Performance History - 보고서 제출용)')
      .setBackground('#0f172a')
      .setFontColor('#f8fafc')
      .setFontSize(11)
      .setFontWeight('bold');

  var dailyHeaders = ['날짜', '요일', '총 입장자', '모자이크 완주', '완주율', '1차촬영율', '추가촬영(2차)', '다운로드', '다운로드율', '평균체류', '피크시간대', '성과종합', '기타'];
  dash.getRange('B16:N16').setValues([dailyHeaders])
      .setBackground('#1e293b')
      .setFontColor('#f8fafc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  dash.setRowHeight(16, 26);

  var dailyRows = analytics.dailyRows; // 최근 14일 일일 데이터 배열
  if (dailyRows.length > 0) {
    dash.getRange(17, 2, dailyRows.length, dailyHeaders.length)
        .setValues(dailyRows)
        .setHorizontalAlignment('center')
        .setBackground('#ffffff');
        
    for (var d = 0; d < dailyRows.length; d++) {
      var rowNum = 17 + d;
      dash.setRowHeight(rowNum, 24);
      if (d === 0) {
        // 오늘 행 강조 (소프트 스카이 블루)
        dash.getRange(rowNum, 2, 1, dailyHeaders.length).setBackground('#f0f9ff').setFontWeight('bold');
      }
    }
  }
}

// 당월 세션 로그 데이터 정밀 분석 (오늘 + 시간대별 + 일자별)
function analyzeMonthlyLog(ss, monthSheetName, todayStr) {
  var today = {
    total: 0, capture1: 0, completed: 0, retry: 0, download: 0, staySum: 0, stayCount: 0
  };
  var hourly = {
    m9_12: 0, c9_12: 0,
    m12_14: 0, c12_14: 0,
    m14_16: 0, c14_16: 0,
    m16_18: 0, c16_18: 0,
    m18_21: 0, c18_21: 0
  };
  var dailyMap = {}; // 'YYYY. MM. DD' -> { total, capture1, completed, retry, download, staySum, stayCount }
  var monthTotal = 0;

  var sheet = ss.getSheetByName(monthSheetName);
  if (sheet) {
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var accessTime = String(row[1] || '');
      if (!accessTime) continue;

      monthTotal++;
      var datePart = accessTime.slice(0, 13).trim(); // "YYYY. MM. DD"
      var hourPart = parseInt(accessTime.slice(14, 16), 10) || 0;

      var capVal = String(row[2] || '');
      var isCap = capVal.indexOf('성공') !== -1;
      var statusVal = String(row[7] || '');
      var isCompleted = statusVal.indexOf('COMPLETED') !== -1;
      var retryVal = String(row[4] || '');
      var isRetry = retryVal.indexOf('재도전') !== -1 || retryVal.indexOf('YES') !== -1;
      var downVal = String(row[6] || '');
      var isDown = downVal.indexOf('완료') !== -1;
      var staySec = parseFloat(String(row[8] || '').replace('s', '').replace('초', '')) || 0;

      // 1. 일자별 맵 적재
      if (!dailyMap[datePart]) {
        dailyMap[datePart] = { total: 0, capture1: 0, completed: 0, retry: 0, download: 0, staySum: 0, stayCount: 0 };
      }
      var dObj = dailyMap[datePart];
      dObj.total++;
      if (isCap) dObj.capture1++;
      if (isCompleted) dObj.completed++;
      if (isRetry) dObj.retry++;
      if (isDown) dObj.download++;
      if (staySec > 0) { dObj.staySum += staySec; dObj.stayCount++; }

      // 2. 오늘 데이터 및 시간대별 적재
      if (accessTime.indexOf(todayStr) !== -1) {
        today.total++;
        if (isCap) today.capture1++;
        if (isCompleted) today.completed++;
        if (isRetry) today.retry++;
        if (isDown) today.download++;
        if (staySec > 0) { today.staySum += staySec; today.stayCount++; }

        if (hourPart >= 9 && hourPart < 12) { hourly.m9_12++; if (isCompleted) hourly.c9_12++; }
        else if (hourPart >= 12 && hourPart < 14) { hourly.m12_14++; if (isCompleted) hourly.c12_14++; }
        else if (hourPart >= 14 && hourPart < 16) { hourly.m14_16++; if (isCompleted) hourly.c14_16++; }
        else if (hourPart >= 16 && hourPart < 18) { hourly.m16_18++; if (isCompleted) hourly.c16_18++; }
        else if (hourPart >= 18 && hourPart <= 21) { hourly.m18_21++; if (isCompleted) hourly.c18_21++; }
      }
    }
  }

  // 일자별 통계 행 변환 (최신순 최대 14일)
  var sortedDates = Object.keys(dailyMap).sort().reverse().slice(0, 14);
  var dailyRows = [];

  for (var k = 0; k < sortedDates.length; k++) {
    var dt = sortedDates[k];
    var item = dailyMap[dt];
    var compRate = item.total > 0 ? ((item.completed / item.total)*100).toFixed(1)+'%' : '0.0%';
    var capRate = item.total > 0 ? ((item.capture1 / item.total)*100).toFixed(1)+'%' : '0.0%';
    var downRate = item.completed > 0 ? ((item.download / item.completed)*100).toFixed(1)+'%' : '0.0%';
    var avgStay = item.stayCount > 0 ? (item.staySum / item.stayCount).toFixed(0)+'s' : '0s';

    var dayOfWeek = getDayOfWeekStr(dt);
    var evalTag = parseFloat(compRate) >= 85 ? '🌟 우수' : '⚪ 보통';

    dailyRows.push([
      dt,
      dayOfWeek,
      item.total + '명',
      item.completed + '건',
      compRate,
      capRate,
      item.retry + '건',
      item.download + '건',
      downRate,
      avgStay,
      '14:00~16:00',
      evalTag,
      dt === todayStr ? '오늘 (진행중)' : '마감'
    ]);
  }

  // 오늘 데이터 포맷
  var todayResult = {
    total: today.total,
    capture1: today.capture1,
    completed: today.completed,
    retry: today.retry,
    download: today.download,
    completionRate: today.total > 0 ? ((today.completed / today.total)*100).toFixed(1)+'%' : '0.0%',
    captureRate: today.total > 0 ? ((today.capture1 / today.total)*100).toFixed(1)+'%' : '0.0%',
    retryRate: today.completed > 0 ? ((today.retry / today.completed)*100).toFixed(1)+'%' : '0.0%',
    downloadRate: today.completed > 0 ? ((today.download / today.completed)*100).toFixed(1)+'%' : '0.0%',
    avgStay: today.stayCount > 0 ? (today.staySum / today.stayCount).toFixed(0)+'s' : '0s'
  };

  return {
    today: todayResult,
    hourly: hourly,
    dailyRows: dailyRows,
    monthTotal: monthTotal
  };
}

function getTrafficTag(val, max) {
  if (val === 0) return '원활';
  if (val >= max * 0.75) return '🔥 피크';
  if (val >= max * 0.4) return '🟡 보통';
  return '🟢 원활';
}

function getDayOfWeekStr(dateStr) {
  // "YYYY. MM. DD" -> 요일
  try {
    var parts = dateStr.split('.').map(function(s) { return parseInt(s.trim(), 10); });
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[d.getDay()] + '요일';
  } catch (e) {
    return '-';
  }
}

function ensureDashboardFirst(ss) {
  var dash = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (dash) {
    ss.setActiveSheet(dash);
    ss.moveActiveSheet(1);
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
