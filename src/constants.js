// 초기 기본값 (설정 시트에서 불러오기 전까지 사용)
export const DEFAULT_DEPT_NAME = "청소년부";
export const DEFAULT_YEAR = 2026;

export const LOCAL_KEY = "youth-expenses-dynamic"; // 연도별 유연성을 위해 키 변경 고려 가능
export const CLOUD_META = "youth-cloud-meta";
export const GS_META = "youth-gscript-meta";

export const DEFAULT_BUDGET = {
  year: 2026,
  total: 25092000,
  items: [
    { key: "예배비", budget: 1300000 },
    { key: "교육비", budget: 8082000 },
    { key: "교사교육비", budget: 500000 },
    { key: "행사비", budget: 1210000 },
    { key: "성경학교 및 수련회", budget: 13500000 },
    { key: "운영행정비", budget: 500000 },
  ],
};

export const CATEGORY_ORDER = DEFAULT_BUDGET.items.map((i) => i.key);

// 이 URL과 토큰은 최초 접속을 위한 '마스터' 정보입니다.
export const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwCzVU0q9fJXULx-Zqmw5xak1ekJoaJWsejHeWQ5FAynMrTjEdD2f6JxDT9f9WcfOj/exec";
export const DEFAULT_SCRIPT_TOKEN = "thank1234!!";

// GID 등은 나중에 설정 시트에서 받아오도록 확장 가능하지만, 
// 현재는 안정성을 위해 상수로 유지하되 필요한 것만 남깁니다.
export const MEMBERS_SHEET_INDEX = 6;
export const ATTENDANCE_SHEET_GID = "348133938";
export const FELLOWSHIP_SHEET_GID = "1416333507";
export const BUDGET_GUIDE_GID = "1805455987";
