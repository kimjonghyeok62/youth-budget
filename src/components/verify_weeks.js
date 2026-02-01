
const selectedYear = 2026;

const getMonthWeeks = (month) => {
    // Calculate Sunday dates for the given month and year
    const sundayDates = [];
    const d = new Date(selectedYear, month - 1, 1);

    // Find first Sunday (0)
    // Currently Saturday is 6. Sunday is 0.
    while (d.getDay() !== 0) {
        d.setDate(d.getDate() + 1);
    }

    // Collect all Sundays in month
    while (d.getMonth() === month - 1) {
        sundayDates.push(d.getDate());
        d.setDate(d.getDate() + 7);
    }

    return sundayDates.map((d, i) => ({
        label: `${month}월 ${i + 1}주차`,
        date: `(${month}월 ${d}일)`
    }));
};

console.log("--- Jan 2026 Weeks (Sunday Base) ---");
console.log(getMonthWeeks(1));

// Test Birthday Logic for Jan 1st week (Jan 4)
const testBirthdayLogic = () => {
    // Jan 4 is Sunday. Week range: Jan 4 (Sun) to Jan 10 (Sat).
    // Test cases:
    // 1. Jan 3 (Saturday before) -> Should NOT be in week 1? 
    //    User said: "1월 1주차 (1월 4일)"
    //    "생일자는 일요일부터~토요일까지 있는 사람들을 그 주 일요일에 넣을 수 있도록 해줘"
    //    So for Jan 4 week: Includes Jan 4, 5, 6, 7, 8, 9, 10.
    //    Jan 3 is excluded. Correct? Yes, user said "1월 5주차는 없게 될 것이다". 
    //    Wait, if I use Sunday base, Jan 2026:
    //    Jan 1 (Thu), 2 (Fri), 3 (Sat).
    //    Jan 4 (Sun) -> 1st Sunday.
    //    So Jan 1-3 are effectively orphaned / or belong to previous year's Dec last week?
    //    The user seems ok with "1월 1주차 (1월 4일)".

    const weekStart = new Date(selectedYear, 0, 4); // Jan 4
    const weekEnd = new Date(selectedYear, 0, 11); // Jan 11 (Exclusive)

    const checkDate = (m, d) => {
        const date = new Date(selectedYear, m - 1, d);
        return date >= weekStart && date < weekEnd;
    };

    console.log("Jan 3 Included?", checkDate(1, 3)); // Expected: false
    console.log("Jan 4 Included?", checkDate(1, 4)); // Expected: true
    console.log("Jan 10 Included?", checkDate(1, 10)); // Expected: true
    console.log("Jan 11 Included?", checkDate(1, 11)); // Expected: false
};

console.log("--- Birthday Logic Check ---");
testBirthdayLogic();
