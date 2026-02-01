import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Users, UserPlus, CheckCircle, CheckSquare, Image as ImageIcon, Search,
    ChevronDown, ChevronUp, Edit2, Trash2, Camera, RefreshCw,
    ExternalLink, ArrowRight, ArrowLeft, Calendar, Plus, Upload, Save, Table2, Folder
} from 'lucide-react';
import { gsFetch } from '../utils/google';
import { formatKRW, parseAmount } from '../utils/format';
import { compressImage } from '../utils/dataUrl';
import Card from './Card';
import { useLocalStorageState } from '../hooks/useLocalStorageState';

import { ATTENDANCE_SHEET_GID, MEMBERS_SHEET_INDEX } from '../constants';
import { useConfig } from '../context/ConfigContext';

export default function Attendance({ gsCfg, onJumpToTab, initialMembers = [], initialAttendanceData = { headers: [], records: [] }, onRefreshAttendance, onAttendanceUpdate }) {
    const { config } = useConfig();
    const [members, setMembers] = useState(initialMembers);
    const [attendanceData, setAttendanceData] = useState(initialAttendanceData);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // ID가 없는 멤버에게 UUID 부여 (중복 추가 방지)
        const validated = initialMembers.map(m => ({
            ...m,
            id: m.id && m.id.trim() !== "" ? m.id : crypto.randomUUID()
        }));
        setMembers(validated);
    }, [initialMembers]);

    useEffect(() => {
        setAttendanceData(initialAttendanceData);
    }, [initialAttendanceData]);

    const [memberType, setMemberType] = useState('학생');
    const [memberForm, setMemberForm] = useState({
        id: '', name: '', age: '', position: '', group: '', teacher: '',
        assignedStudents: '',
        regDate: new Date().toISOString().split('T')[0],
        leaveDate: '',
        photoUrl: '', photoDriveId: '', s1: '', s2: '', s3: '',
        phone: '', birthdate: '', school: '', mbti: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState(null);
    const [expandedTeacherStudentsId, setExpandedTeacherStudentsId] = useState(null);

    const today = new Date();
    const selectedYear = config.year;
    const [monthRange, setMonthRange] = useState(() => {
        const now = new Date();
        const curYear = now.getFullYear();
        const m = now.getMonth() + 1;

        // 관리 연도가 현재 연도보다 크면(미래) 1-2월 고정
        if (curYear < selectedYear) return [1, 2];

        if (m <= 2) return [1, 2];
        if (m <= 4) return [3, 4];
        if (m <= 6) return [5, 6];
        if (m <= 8) return [7, 8];
        if (m <= 10) return [9, 10];
        return [11, 12];
    });

    // 연도가 바뀌면(특히 미래 연도로 변경 시) 월 범위를 1-2월로 초기화
    useEffect(() => {
        const now = new Date();
        if (now.getFullYear() < selectedYear) {
            setMonthRange([1, 2]);
        }
    }, [selectedYear]);

    const monthRangeOptions = [
        { label: "1-2월", months: [1, 2] },
        { label: "3-4월", months: [3, 4] },
        { label: "5-6월", months: [5, 6] },
        { label: "7-8월", months: [7, 8] },
        { label: "9-10월", months: [9, 10] },
        { label: "11-12월", months: [11, 12] },
    ];

    const getMonthWeeks = (month) => {
        // Calculate Sunday dates for the given month and year
        const sundayDates = [];
        const d = new Date(selectedYear, month - 1, 1);

        // Find first Sunday
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

    const currentMonthRangeHeaders = useMemo(() => {
        const headers = [];
        monthRange.forEach(m => {
            headers.push(...getMonthWeeks(m));
        });
        return headers;
    }, [monthRange]);

    const uniqueGroups = useMemo(() => {
        const groups = members.map(m => m.group).filter(g => g && g.trim() !== "" && !(g.length > 10 && g.includes('T')));
        return [...new Set(groups)].sort();
    }, [members]);

    const getWeekDate = (weekHeader) => {
        const dateMatch = weekHeader.match(/(\d+)월 (\d+)주차/);
        if (!dateMatch) return null;
        const m = parseInt(dateMatch[1]);
        const w = parseInt(dateMatch[2]);
        const weekInfo = getMonthWeeks(m)[w - 1];
        if (!weekInfo) return null;
        const dMatch = weekInfo.date.match(/\((\d+)월 (\d+)일\)/);
        if (!dMatch) return null;
        return new Date(`${selectedYear}-${String(dMatch[1]).padStart(2, '0')}-${String(dMatch[2]).padStart(2, '0')}`);
    };

    const isRegistered = (member, weekHeader) => {
        if (!member.regDate) return true;
        const weekDate = getWeekDate(weekHeader);
        if (!weekDate) return true;
        return new Date(member.regDate) <= weekDate;
    };

    const isLeft = (member, weekHeader) => {
        if (!member.leaveDate) return false;
        const weekDate = getWeekDate(weekHeader);
        if (!weekDate) return false;
        // If leaveDate is BEFORE weekDate, it's left. (Next day logic)
        return new Date(member.leaveDate) < weekDate;
    };

    const isActive = (member, weekHeader) => {
        return isRegistered(member, weekHeader) && !isLeft(member, weekHeader);
    };

    const isCurrentlyActive = (member) => {
        const now = new Date();
        const tStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const registered = !member.regDate || member.regDate <= tStr;
        const left = member.leaveDate && member.leaveDate < tStr;
        return registered && !left;
    };

    const getInactiveLabel = (member) => {
        const now = new Date();
        const tStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (member.regDate && member.regDate > tStr) return "(등록전)";
        if (member.leaveDate && member.leaveDate < tStr) return "(전출)";
        return "";
    };

    const getTransferItems = (weekHeader) => {
        const weekDate = getWeekDate(weekHeader);
        if (!weekDate) return [];

        const prevWeekDate = new Date(weekDate);
        prevWeekDate.setDate(prevWeekDate.getDate() - 7);

        const isJanFirstWeek = weekHeader.includes("1월 1주차");

        const joined = isJanFirstWeek ? [] : members.filter(m => {
            if (!m.regDate) return false;
            const d = new Date(m.regDate);
            return d > prevWeekDate && d <= weekDate;
        }).map(m => {
            const d = new Date(m.regDate);
            return { name: m.name, date: `${d.getMonth() + 1}-${d.getDate()}`, type: '등록' };
        });

        const left = members.filter(m => {
            if (!m.leaveDate) return false;
            const d = new Date(m.leaveDate);
            return d > prevWeekDate && d <= weekDate;
        }).map(m => {
            const d = new Date(m.leaveDate);
            return { name: m.name, date: `${d.getMonth() + 1}-${d.getDate()}`, type: '전출' };
        });

        return [...joined, ...left];
    };

    const getTransferInfo = (weekHeader) => {
        const items = getTransferItems(weekHeader);
        return items.map(item => `${item.name}\n(${item.date} ${item.type})`).join(', ');
    };

    const getBirthdayItems = (weekHeader) => {
        const dateMatch = weekHeader.match(/(\d+)월 (\d+)주차/);
        if (!dateMatch) return [];
        const mIdx = parseInt(dateMatch[1]);
        const wIdx = parseInt(dateMatch[2]);
        const monthWeeks = getMonthWeeks(mIdx);
        const weekInfo = monthWeeks[wIdx - 1];
        if (!weekInfo) return [];

        const dMatch = weekInfo.date.match(/\((\d+)월 (\d+)일\)/);
        if (!dMatch) return [];

        const weekStart = new Date(selectedYear, parseInt(dMatch[1]) - 1, parseInt(dMatch[2]));
        const weekEnd = new Date(selectedYear, parseInt(dMatch[1]) - 1, parseInt(dMatch[2]) + 7);

        return members.filter(member => member.birthdate).filter(member => {
            const bMatch = member.birthdate.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/);
            if (!bMatch) return false;
            const bM = parseInt(bMatch[2]);
            const bD = parseInt(bMatch[3]);
            const birthdayInThisYear = new Date(selectedYear, bM - 1, bD);
            return birthdayInThisYear >= weekStart && birthdayInThisYear < weekEnd;
        }).map(member => {
            const bMatch = member.birthdate.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/);
            return {
                name: member.name,
                month: parseInt(bMatch[2]),
                day: parseInt(bMatch[3])
            };
        });
    };
    const [sortOrder, setSortOrder] = useState('asc');
    const isFirstRender = useRef(true);
    const scrollRefs = {
        attendanceHeader: useRef(null),
        attendanceBody: useRef(null),
        studentHeader: useRef(null),
        studentBody: useRef(null),
        teacherHeader: useRef(null),
        teacherBody: useRef(null)
    };

    const handleSyncScroll = (target, e) => {
        if (target.current) {
            target.current.scrollLeft = e.target.scrollLeft;
        }
    };

    const speedScrollTo = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-yellow-100/80');
            setTimeout(() => element.classList.remove('bg-yellow-100/80'), 5000);
        }
    };

    const scrollToId = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-yellow-100/80');
            setTimeout(() => element.classList.remove('bg-yellow-100/80'), 5000);
        }
    };

    const highlightByClass = (className) => {
        const studentRows = document.querySelectorAll(`[id^="list-row-"]`);
        let firstMatch = null;
        studentRows.forEach(row => {
            const classCell = row.querySelector('.class-cell');
            if (classCell && classCell.textContent.trim() === className) {
                if (!firstMatch) firstMatch = row;
                row.classList.add('bg-yellow-100');
                setTimeout(() => row.classList.remove('bg-yellow-100'), 2000);
            }
        });
        if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const highlightByName = (studentName) => {
        const studentRows = document.querySelectorAll(`[id^="list-row-"]`);
        studentRows.forEach(row => {
            const nameCell = row.querySelector('.name-cell');
            if (nameCell && nameCell.textContent.trim() === studentName) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => row.classList.remove('bg-yellow-100'), 5000);
            }
        });
    };

    const highlightTeacherByName = (name) => {
        const teacher = members.find(m => m.type === '선생님' && m.name === name);
        if (teacher) {
            speedScrollTo(`list-row-teacher-${teacher.id}`);
        }
    };

    const speedScrollToTeacherByName = (teacherName) => {
        if (!teacherName) return;
        const teacher = members.find(m => m.type === '선생님' && m.name === teacherName.trim());
        if (teacher) {
            speedScrollTo(`list-row-teacher-${teacher.id}`);
        } else {
            alert(`'${teacherName}' 선생님을 교사 명단에서 찾을 수 없습니다.`);
        }
    };

    const handleAttendanceNameClick = (m) => {
        if (m.type === '학생') {
            if (m.photoUrl) {
                const galleryEl = document.getElementById(`gallery-member-${m.id}`);
                if (galleryEl) {
                    speedScrollTo(`gallery-member-${m.id}`);
                } else {
                    // Fallback: search in gallery if ID doesn't match yet
                    const galleryMembers = document.querySelectorAll('[id^="gallery-member-"]');
                    let found = false;
                    galleryMembers.forEach(card => {
                        if (card.querySelector('h4')?.textContent.trim() === m.name) {
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            card.classList.add('bg-yellow-100/80');
                            setTimeout(() => card.classList.remove('bg-yellow-100/80'), 5000);
                            found = true;
                        }
                    });
                    if (!found) speedScrollTo(`list-row-${m.id}`); // Fallback to list if gallery fail
                }
            } else {
                const rowEl = document.getElementById(`list-row-${m.id}`);
                if (rowEl) {
                    speedScrollTo(`list-row-${m.id}`);
                } else {
                    highlightByName(m.name);
                }
            }
        } else {
            const teacherRowEl = document.getElementById(`list-row-teacher-${m.id}`);
            if (teacherRowEl) {
                speedScrollTo(`list-row-teacher-${m.id}`);
            } else {
                // Fallback for teacher
                const rows = document.querySelectorAll('tr[id^="list-row-teacher-"]');
                rows.forEach(row => {
                    const nameCell = row.querySelector('.name-cell');
                    if (nameCell && nameCell.textContent.trim() === m.name) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        row.classList.add('bg-yellow-100/80');
                        setTimeout(() => row.classList.remove('bg-yellow-100/80'), 5000);
                    }
                });
            }
        }
    };

    useEffect(() => {
        if (initialMembers.length === 0 && isFirstRender.current) {
            onRefreshAttendance?.();
        }
        isFirstRender.current = false;
    }, [initialMembers, onRefreshAttendance]);

    // [추가] 목장별 담임선생님-담당학생 자동 매핑 헬퍼 함수
    const syncRelationshipData = (membersList) => {
        const teachersMap = {};
        membersList.filter(m => m.type === '선생님').forEach(t => {
            if (t.group) {
                teachersMap[t.group] = t.name;
            }
        });

        const studentsMap = {};
        membersList.filter(m => m.type === '학생').forEach(s => {
            if (s.group) {
                if (!studentsMap[s.group]) studentsMap[s.group] = [];
                studentsMap[s.group].push(s.name);
            }
        });

        return membersList.map(m => {
            if (m.type === '학생') {
                return { ...m, teacher: teachersMap[m.group] || "" };
            } else {
                return { ...m, assignedStudents: (studentsMap[m.group] || []).join(', ') };
            }
        });
    };

    const handleMemberSubmit = async (e) => {
        e.preventDefault();
        if (!memberForm.name) return alert("이름을 입력해주세요.");

        // 현재 상태를 상수로 캡처하여 비동기 작업 중 상태 변화 방지
        const currentEditId = editingMemberId;
        const finalId = currentEditId || crypto.randomUUID();
        const activeType = memberType;

        const newMember = {
            ...memberForm,
            id: finalId,
            type: activeType
        };

        const combinedMembers = currentEditId
            ? members.map(m => m.id === currentEditId ? newMember : m)
            : [...members, newMember];

        const updatedMembers = syncRelationshipData(combinedMembers);

        setMembers(updatedMembers);
        onAttendanceUpdate?.({ members: updatedMembers });
        resetMemberForm();
        setEditingMemberId(null);

        gsFetch(gsCfg, 'saveMembers', { members: updatedMembers }).then(() => {
            // 명단 저장 성공 시 출석부도 즉시 동기화 (새 멤버 추가 시 필요)
            saveAttendance(true, null, updatedMembers);
            alert(currentEditId ? "수정하였습니다." : "추가하였습니다.");
        }).catch(err => {
            console.error("Save failed", err);
            alert("서버 저장 실패: " + err.message);
        });
    };

    const resetMemberForm = () => {
        setMemberForm({
            id: '', name: '', age: '', position: '', group: '', teacher: '',
            assignedStudents: '',
            regDate: new Date().toISOString().split('T')[0],
            leaveDate: '',
            photoUrl: '', photoDriveId: '', s1: '', s2: '', s3: '',
            phone: '', birthdate: '', school: '', mbti: ''
        });
    };

    const handleEditMember = (m) => {
        setMemberType(m.type);
        setMemberForm(m);
        setEditingMemberId(m.id);
        const element = document.getElementById('member-form-section');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo(0, 0);
        }
    };

    const handleDeleteMember = async (id) => {
        if (!confirm("정말 삭제하시겠습니까? 데이터가 명단에서 영구히 삭제됩니다.")) return;
        const updated = members.filter(m => m.id !== id);
        setMembers(updated);
        onAttendanceUpdate?.({ members: updated });
        gsFetch(gsCfg, 'saveMembers', { members: updated }).then(() => {
            // 멤버 삭제 시 출석부도 즉시 동기화 (행 삭제 및 통계 갱신)
            saveAttendance(true, null, updated);
        }).catch(e => {
            alert("서버 삭제 실패: " + e.message);
        });
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const compressed = await compressImage(file);
            const filename = `member_${memberForm.name || 'temp'}_${Date.now()}.jpg`;
            const res = await gsFetch(gsCfg, 'uploadMemberPhoto', {
                filename, mimeType: 'image/jpeg', dataUrl: compressed.dataUrl
            });
            if (res.viewUrl) {
                setMemberForm(prev => ({ ...prev, photoUrl: res.viewUrl, photoDriveId: res.fileId }));
            }
        } catch (err) {
            alert("업로드 실패: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const isWeekLocked = (weekHeader) => {
        const lockRecord = attendanceData.records.find(r => r.memberId === 'SYSTEM_LOCK');
        return lockRecord && lockRecord[weekHeader] === 'LOCKED';
    };

    const handleToggleLock = (weekHeader) => {
        const currentlyLocked = isWeekLocked(weekHeader);
        if (currentlyLocked && !confirm("정말 마감을 해제하시겠습니까?")) return;

        const nextRecords = [...attendanceData.records];
        let lockIdx = nextRecords.findIndex(r => r.memberId === 'SYSTEM_LOCK');

        const newVal = currentlyLocked ? 'UNLOCKED' : 'LOCKED';

        if (lockIdx !== -1) {
            nextRecords[lockIdx] = { ...nextRecords[lockIdx], [weekHeader]: newVal };
        } else {
            nextRecords.push({ memberId: 'SYSTEM_LOCK', [weekHeader]: newVal });
        }
        setAttendanceData({ ...attendanceData, records: nextRecords });

        // 마감 시 즉시 서버에 저장
        saveAttendance(false, nextRecords);
    };

    const handleAttendanceChange = (m, weekHeader, checked) => {
        if (isWeekLocked(weekHeader)) {
            alert("해당 주차는 마감되어 변경할 수 없습니다.");
            return;
        }
        const val = checked ? "O" : "X";
        const nextRecords = attendanceData.records.map(r => {
            // Match by memberId primarily, fallback to Name+Type
            if ((r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type)) {
                return { ...r, memberId: m.id, type: m.type, [weekHeader]: val };
            }
            return r;
        });

        if (!nextRecords.find(r => (r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type))) {
            nextRecords.push({ "이름": m.name, type: m.type, memberId: m.id, [weekHeader]: val });
        }

        setAttendanceData({ ...attendanceData, records: nextRecords });
    };

    const handleBulkSelect = (weekHeader) => {
        if (isWeekLocked(weekHeader)) {
            alert("해당 주차는 마감되어 변경할 수 없습니다.");
            return;
        }
        const nextRecords = [...attendanceData.records];

        // Determine if all are currently checked
        const allChecked = members.every(m => {
            const r = nextRecords.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type));
            return r && r[weekHeader] === "O";
        });

        const targetVal = allChecked ? "X" : "O";

        members.forEach(m => {
            const idx = nextRecords.findIndex(r => (r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type));
            if (idx !== -1) {
                nextRecords[idx] = { ...nextRecords[idx], [weekHeader]: targetVal };
            } else {
                nextRecords.push({ "이름": m.name, type: m.type, memberId: m.id, [weekHeader]: targetVal });
            }
        });
        setAttendanceData({ ...attendanceData, records: nextRecords });
    };



    const saveAttendance = async (isAuto = false, overrideRecords = null, overrideMembers = null) => {
        if (isAuto && !overrideRecords && !overrideMembers) setIsSaving(true);
        else if (!isAuto) setLoading(true);

        const startTime = Date.now();

        try {
            const baseRecords = overrideRecords || attendanceData.records;

            // Performance Optimization: Create a lookup map for records
            const recordLookup = new Map();
            baseRecords.forEach(r => {
                const key = r.memberId || `${r["이름"]}_${r.type}`;
                recordLookup.set(key, r);
            });

            // Generate ALL possible week headers for the year to ensure a stable, sorted sheet structure
            const allYearWeekHeaders = [];
            for (let m = 1; m <= 12; m++) {
                allYearWeekHeaders.push(...getMonthWeeks(m).map(w => w.label));
            }
            const allHeaders = ["memberId", "type", "이름", "목장", "담임선생님", ...allYearWeekHeaders];

            const currentMembers = overrideMembers || members;
            const studentMembers = currentMembers.filter(m => m.type === '학생');
            const teacherMembers = currentMembers.filter(m => m.type === '선생님');

            // Sorting for attendance members logic (replicate sorting used in useMemo)
            const sortMembers = (a, b) => {
                const groupA = a.group || "";
                const groupB = b.group || "";
                if (groupA !== groupB) return groupA.localeCompare(groupB);
                return (a.name || "").localeCompare(b.name || "");
            };
            const sortByName = (a, b) => (a.name || "").localeCompare(b.name || "");

            const sortedS = [...studentMembers].sort(sortMembers);
            const sortedT = [...teacherMembers].sort(sortByName);
            const targetAttendanceMembers = [...sortedS, ...sortedT];

            // Reconstruct records based on target members to ensure strict sync
            const syncedRecords = targetAttendanceMembers.map(m => {
                const existing = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                const record = {
                    memberId: m.id,
                    type: m.type,
                    "이름": m.name,
                    "목장": m.group || "",
                    "담임선생님": (m.type === '학생' ? (teacherMembers.find(t => t.group === m.group)?.name || m.teacher || "") : "")
                };

                // Add attendance data with (미반영) fallback for inactive weeks
                allYearWeekHeaders.forEach(week => {
                    if (!isActive(m, week)) {
                        record[week] = "(미반영)";
                    } else {
                        const val = existing[week] || "";
                        // If it was previously (미반영) but now active, clear it
                        record[week] = val === "(미반영)" ? "" : val;
                    }
                });

                return record;
            });

            // Calculate background colors for member records
            const backgrounds = targetAttendanceMembers.map(m => {
                return allHeaders.map(h => {
                    if (h === "memberId" || h === "type" || h === "이름" || h === "목장" || h === "담임선생님") return "#FFFFFF";

                    // Check if member is active during this week
                    const registered = isRegistered(m, h);
                    const left = isLeft(m, h);
                    return (!registered || left) ? "#E0E0E0" : "#FFFFFF"; // Gray if inactive, white if active
                });
            });

            // Include system lock record if exists
            const lockRecord = recordLookup.get('SYSTEM_LOCK');
            if (lockRecord) {
                syncedRecords.push(lockRecord);
                backgrounds.push(allHeaders.map(() => "#FFFFFF")); // Lock record is all white
            }

            // --- Add Statistics Rows ---
            // (studentMembers and teacherMembers already extracted above)

            const studentStats = { memberId: 'STATS_STUDENT', type: '통계', "이름": '학생 출석' };
            const teacherStats = { memberId: 'STATS_TEACHER', type: '통계', "이름": '교사 출석' };
            const totalStats = { memberId: 'STATS_TOTAL', type: '통계', "이름": '전체 출석' };
            const transferStats = { memberId: 'STATS_TRANSFER', type: '통계', "이름": '전입 전출' };
            const studentAbsentStats = { memberId: 'STATS_STUDENT_ABSENT', type: '통계', "이름": '학생 결석자' };
            const teacherAbsentStats = { memberId: 'STATS_TEACHER_ABSENT', type: '통계', "이름": '교사 결석자' };
            const birthdayStats = { memberId: 'STATS_BIRTHDAY', type: '통계', "이름": '생일자' };

            const currentLockRecord = lockRecord || {};

            allYearWeekHeaders.forEach(week => {
                const isLocked = currentLockRecord[week] === 'LOCKED';

                const studentRegistered = studentMembers.filter(m => isActive(m, week));
                const teacherRegistered = teacherMembers.filter(m => isActive(m, week));
                const totalRegistered = currentMembers.filter(m => isActive(m, week));

                const sAttended = studentRegistered.filter(m => {
                    const r = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                    return r[week] === "O";
                }).length;

                const tAttended = teacherRegistered.filter(m => {
                    const r = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                    return r[week] === "O";
                }).length;

                const sAbsentNames = isLocked ? studentRegistered.filter(m => {
                    const r = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                    return r[week] !== "O";
                }).map(m => m.name).join('\n') : '';

                const tAbsentNames = isLocked ? teacherRegistered.filter(m => {
                    const r = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                    return r[week] !== "O";
                }).map(m => m.name).join('\n') : '';

                const birthdayPeopleNames = studentMembers.filter(member => member.birthdate).filter(member => {
                    const dateMatch = week.match(/(\d+)월 (\d+)주차/);
                    if (!dateMatch) return false;
                    const weekInfo = getMonthWeeks(parseInt(dateMatch[1]))[parseInt(dateMatch[2]) - 1];
                    const dMatch = weekInfo.date.match(/\((\d+)월 (\d+)일\)/);
                    if (!dMatch) return false;
                    const weekStart = new Date(selectedYear, parseInt(dMatch[1]) - 1, parseInt(dMatch[2]));
                    const weekEnd = new Date(selectedYear, parseInt(dMatch[1]) - 1, parseInt(dMatch[2]) + 7);

                    const bMatch = member.birthdate.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/);
                    if (!bMatch) return false;
                    const bM = parseInt(bMatch[2]);
                    const bD = parseInt(bMatch[3]);
                    const birthdayInThisYear = new Date(selectedYear, bM - 1, bD);
                    return birthdayInThisYear >= weekStart && birthdayInThisYear < weekEnd;
                }).map(member => {
                    const bMatch = member.birthdate.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/);
                    return `${member.name}\n(${parseInt(bMatch[2])}-${parseInt(bMatch[3])})`;
                }).join('\n');

                studentStats[week] = `${sAttended} / ${studentRegistered.length}`;
                teacherStats[week] = `${tAttended} / ${teacherRegistered.length}`;
                totalStats[week] = `${sAttended + tAttended} / ${totalRegistered.length}`;
                transferStats[week] = getTransferInfo(week);
                studentAbsentStats[week] = sAbsentNames;
                teacherAbsentStats[week] = tAbsentNames;
                birthdayStats[week] = birthdayPeopleNames;
            });

            syncedRecords.push(studentStats, teacherStats, totalStats, transferStats, studentAbsentStats, teacherAbsentStats, birthdayStats);

            // Statistics rows are all white backgrounds
            for (let i = 0; i < 7; i++) {
                backgrounds.push(allHeaders.map(() => "#FFFFFF"));
            }

            // [추가] 출석 저장 시 멤버들 간의 관계(담임-학생)를 최신화하여 멤버 시트도 함께 동기화
            const syncedMembers = syncRelationshipData(currentMembers);

            await Promise.all([
                gsFetch(gsCfg, 'saveAttendance', { headers: allHeaders, records: syncedRecords, backgrounds }),
                gsFetch(gsCfg, 'saveMembers', { members: syncedMembers })
            ]);

            // 로컬 멤버 상태도 업데이트 (자동 계산된 관계 반영)
            setMembers(syncedMembers);
            onAttendanceUpdate?.({ members: syncedMembers });

            // Race Condition Fix: Only update if no newer changes occurred (or merge smarter)
            // But since local changes are stored in attendanceData.records, we can merge.
            setAttendanceData(prev => {
                // If there were concurrent changes, we should PRESERVE them.
                // syncedRecords is based on baseRecords (snapshot)
                // prev.records might be newer.

                // For simplified "latest wins" logic that respects concurrent edits:
                // We keep the newly synced records, but if prev.records has a record that wasn't in baseRecords,
                // or was modified after startTime, we might need a more complex merge.
                // However, the simplest fix for "vanishing edits" is to use a functional update and
                // only update if the sync was the latest action.

                // Alternatively, just update the global state with the synced data if it hasn't changed much
                // or notify the user.

                // Let's implement a "check if changed" logic
                if (prev.records === baseRecords) {
                    return { headers: allHeaders, records: syncedRecords };
                } else {
                    // Merge: take syncedRecords as base, but overwrite with any newer local edits
                    const mergedRecords = [...syncedRecords];
                    prev.records.forEach(newR => {
                        // If newR is 'SYSTEM_LOCK' or a member record, check if it's different from baseRecords
                        const oldR = baseRecords.find(old => old.memberId === newR.memberId);
                        if (JSON.stringify(oldR) !== JSON.stringify(newR)) {
                            const idx = mergedRecords.findIndex(m => m.memberId === newR.memberId);
                            if (idx !== -1) mergedRecords[idx] = { ...mergedRecords[idx], ...newR };
                            else mergedRecords.push(newR);
                        }
                    });
                    return { headers: allHeaders, records: mergedRecords };
                }
            });

            onAttendanceUpdate?.({ attendanceData: { headers: allHeaders, records: syncedRecords } });

            if (!isAuto) {
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`Sync completed in ${duration}s`);
                alert("출석 데이터가 성공적으로 저장 및 동기화되었습니다.");
            }
        } catch (e) {
            if (!isAuto) alert("저장 실패: " + e.message);
        } finally {
            setLoading(false);
            setIsSaving(false);
        }
    };

    const sortMembers = (a, b) => {
        const groupA = a.group || "";
        const groupB = b.group || "";
        if (groupA !== groupB) return groupA.localeCompare(groupB);
        return (a.name || "").localeCompare(b.name || "");
    };

    const sortByName = (a, b) => (a.name || "").localeCompare(b.name || "");

    const sortedStudents = useMemo(() => {
        const students = members.filter(m => m.type === '학생').sort(sortMembers);
        const teachers = members.filter(m => m.type === '선생님');

        // Auto-match teacher for each student
        const mappedStudents = students.map(s => {
            const matchTeacher = teachers.find(t => t.group === s.group);
            return { ...s, teacher: matchTeacher ? matchTeacher.name : (s.teacher || "") };
        });

        // Add groupIndex for alternating background colors in attendance table
        let currentGroup = null;
        let groupIdx = 0;
        return mappedStudents.map(s => {
            if (s.group !== currentGroup) {
                currentGroup = s.group;
                groupIdx++;
            }
            return { ...s, groupIdx };
        });
    }, [members]);

    const sortedTeachers = useMemo(() => {
        const teachers = members.filter(m => m.type === '선생님').sort(sortByName);
        const students = members.filter(m => m.type === '학생');

        // Auto-match students for each teacher
        return teachers.map(t => {
            const matchStudents = students.filter(s => s.group === t.group).map(s => s.name).join(', ');
            return { ...t, assignedStudents: matchStudents || (t.assignedStudents || "") };
        });
    }, [members]);

    const sortedAttendanceMembers = useMemo(() => {
        return [...sortedStudents, ...sortedTeachers];
    }, [sortedStudents, sortedTeachers]);

    const getAttendanceRate = (m) => {
        const allPossibleWeeks = [];
        for (let mon = 1; mon <= 12; mon++) {
            allPossibleWeeks.push(...getMonthWeeks(mon).map(w => w.label));
        }

        const lockRecord = attendanceData.records.find(r => r.memberId === 'SYSTEM_LOCK') || {};
        const closedWeeks = allPossibleWeeks.filter(h => lockRecord[h] === 'LOCKED');

        if (closedWeeks.length === 0) return "0주/0주\n(0%)";

        const record = attendanceData.records.find(r => (r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type)) || {};
        let attendedCount = 0;
        closedWeeks.forEach(h => {
            if (record[h] === "O") attendedCount++;
        });

        const percentage = Math.round((attendedCount / closedWeeks.length) * 100);
        return `${attendedCount}주/${closedWeeks.length}주\n(${percentage}%)`;
    };

    return (
        <div className="space-y-8 pb-20">
            {loading && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-[2px]">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-[280px] w-full mx-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-blue-50 p-4 rounded-full">
                            <RefreshCw className="animate-spin text-blue-600" size={48} strokeWidth={2.5} />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-gray-900 break-keep">데이터 저장 및 동기화 중...</h3>
                            <p className="text-gray-500 text-sm font-medium">잠시만 기다려 주세요 (약 5초 소요)</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. 출석부 */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold">출석부</span>
                        <a
                            href="https://docs.google.com/spreadsheets/d/1VHTf0AxvJ6Jx4RnTlsIJZxHdjrAESTCgOx_vMEXJlTo/edit?gid=348133938#gid=348133938"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                        >
                            <Table2 size={14} className="text-green-600" /> 시트
                        </a>
                    </div>
                }
                right={
                    <div className="relative">
                        <select
                            value={JSON.stringify(monthRange)}
                            onChange={(e) => setMonthRange(JSON.parse(e.target.value))}
                            className="appearance-none bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                        >
                            {monthRangeOptions.map(opt => (
                                <option key={opt.label} value={JSON.stringify(opt.months)}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                }
            >
                <div className="relative">
                    {/* Sticky Header Layer */}
                    <div className="sticky top-[112px] md:top-[84px] z-40 overflow-hidden bg-white -mx-4 px-4">
                        <div ref={scrollRefs.attendanceHeader} className="overflow-hidden scrollbar-hide">
                            <table className="w-full border-collapse table-fixed">
                                <colgroup>
                                    <col className="w-[40px]" />
                                    <col className="w-[50px]" />
                                    <col className="w-[150px]" />
                                    {currentMonthRangeHeaders.map(h => <col key={h.label} className="w-[60px]" />)}
                                </colgroup>
                                <thead className="bg-gray-50">
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="py-3 px-0 bg-gray-50 border-r border-gray-200 text-gray-500 font-normal text-center whitespace-nowrap text-[13px] uppercase tracking-tighter">No.</th>
                                        <th className="py-3 px-0 bg-gray-50 border-r border-gray-200 text-gray-500 font-normal text-center whitespace-nowrap text-[13px] uppercase tracking-tighter">구분</th>
                                        <th className="sticky left-0 z-[45] py-3 px-1 bg-gray-50 border-r border-gray-200 text-gray-500 font-normal text-center whitespace-nowrap text-sm uppercase tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">이름</th>
                                        {currentMonthRangeHeaders.map((h, i) => (
                                            <th key={i} className="py-2 px-1 border-r border-gray-100 text-gray-500 font-normal text-center whitespace-nowrap text-[13px] leading-tight">
                                                <div className="flex flex-col items-center">
                                                    <span>{h.label}</span>
                                                    <span className="text-[13px]">{h.date}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </div>

                    {/* Scrollable Body Layer */}
                    <div ref={scrollRefs.attendanceBody} onScroll={(e) => handleSyncScroll(scrollRefs.attendanceHeader, e)} className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
                        <table className="w-full border-collapse table-fixed">
                            <colgroup>
                                <col className="w-[40px]" />
                                <col className="w-[50px]" />
                                <col className="w-[150px]" />
                                {currentMonthRangeHeaders.map(h => <col key={h.label} className="w-[60px]" />)}
                            </colgroup>
                            <thead className="invisible h-0 overflow-hidden pointer-events-none">
                                <tr>
                                    <th>No.</th>
                                    <th>구분</th>
                                    <th>이름</th>
                                    {currentMonthRangeHeaders.map((h, i) => (
                                        <th key={i}></th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAttendanceMembers.map((m, idx) => {
                                    // Match by memberId primarily, fallback to Name+Type
                                    return (
                                        <tr key={m.id} id={`attendance-row-${m.id}`} className={`border-b border-gray-50 transition-all duration-300 ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-orange-50/50' : 'bg-white') : 'bg-blue-50/40'}`}>
                                            <td className={`py-1 px-0 border-r border-gray-100 text-center font-normal text-gray-400 text-[13px] whitespace-nowrap leading-none tracking-tighter ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-[#fff7ed]' : 'bg-white') : 'bg-[#eff6ff]'}`}>
                                                {idx + 1}
                                            </td>
                                            <td className={`py-1 px-0 border-r border-gray-100 text-center font-normal text-gray-500 text-[13px] whitespace-nowrap leading-none tracking-tighter ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-[#fff7ed]' : 'bg-white') : 'bg-[#eff6ff]'}`}>
                                                {m.type === '학생' ? '학생' : '교사'}
                                            </td>
                                            <td className={`sticky left-0 z-10 py-1 px-1 border-r border-gray-100 font-bold text-base whitespace-nowrap cursor-pointer hover:text-blue-600 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-[#fff7ed]' : 'bg-white') : 'bg-[#eff6ff]'} ${isCurrentlyActive(m) ? 'text-gray-900' : 'text-gray-400'}`} onClick={() => handleAttendanceNameClick(m)}>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-lg font-bold ${!isCurrentlyActive(m) ? 'line-through' : ''}`}>{m.name}</span>
                                                    <div className={`flex items-center gap-1 text-base font-normal mt-0.5 whitespace-nowrap ${isCurrentlyActive(m) ? 'text-gray-900' : 'text-gray-400'}`}>
                                                        <span>{m.group && m.group.length > 10 && m.group.includes('T') ? "목장미정" : m.group}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            {(() => {
                                                const record = attendanceData.records.find(r => (r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type)) || {};
                                                return currentMonthRangeHeaders.map((h, i) => {
                                                    const registered = isRegistered(m, h.label);
                                                    const locked = isWeekLocked(h.label);
                                                    const left = isLeft(m, h.label);
                                                    return (
                                                        <td key={i} className="py-1 px-0.5 border-r border-gray-100 text-center">
                                                            <div
                                                                onClick={() => registered && !left && !locked && handleAttendanceChange(m, h.label, record[h.label] !== "O")}
                                                                className={`w-7 h-7 mx-auto rounded-md flex items-center justify-center transition-all ${!registered || left
                                                                    ? "bg-gray-400 opacity-60 text-gray-500 cursor-not-allowed relative overflow-hidden"
                                                                    : locked
                                                                        ? (record[h.label] === "O" ? "bg-blue-300 text-white cursor-not-allowed" : "bg-gray-50 border border-gray-100 text-transparent cursor-not-allowed")
                                                                        : (record[h.label] === "O" ? 'bg-blue-600 text-white shadow-sm cursor-pointer' : 'bg-gray-50 border border-gray-100 text-transparent cursor-pointer hover:border-blue-200')
                                                                    }`}
                                                            >
                                                                {!registered || left ? (
                                                                    <div className="absolute inset-0 flex items-center justify-center rotate-45 border-t border-gray-400 w-full opacity-50"></div>
                                                                ) : (
                                                                    <CheckSquare size={16} strokeWidth={2.5} />
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                });
                                            })()}
                                        </tr>
                                    );
                                })}

                                {/* 전체체크 행 추가 */}
                                <tr className="border-t border-gray-100 bg-gray-50/30">
                                    <td className="bg-gray-50/80 border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-gray-50/80 border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-0 px-1 bg-gray-50/80 border-r border-gray-100 font-normal text-gray-400 text-base text-center leading-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">전체</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const locked = isWeekLocked(h.label);
                                        return (
                                            <td key={i} className="py-0 px-1 border-r border-gray-100 text-center">
                                                <button
                                                    onClick={() => handleBulkSelect(h.label)}
                                                    className={`font-bold underline text-base transition-colors mx-auto whitespace-nowrap ${locked
                                                        ? "text-gray-300 no-underline cursor-not-allowed"
                                                        : "text-blue-600 hover:text-blue-800 cursor-pointer"
                                                        }`}
                                                    disabled={locked}
                                                    title={`${h.label} 전체 선택/해제`}
                                                >
                                                    {members.every(m => {
                                                        const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type));
                                                        return r && r[h.label] === "O";
                                                    }) ? "전체취소" : "전체"}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* 마감 행 추가 */}
                                <tr className="border-t border-gray-100 bg-gray-50/30">
                                    <td className="bg-gray-50/80 border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-gray-50/80 border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-0 px-1 bg-gray-50/80 border-r border-gray-100 font-normal text-gray-400 text-base text-center leading-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">마감</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const locked = isWeekLocked(h.label);
                                        return (
                                            <td key={i} className="py-0 px-1 border-r border-gray-100 text-center">
                                                <button
                                                    onClick={() => handleToggleLock(h.label)}
                                                    className={`font-bold underline text-base transition-colors mx-auto whitespace-nowrap cursor-pointer ${locked
                                                        ? "text-red-600 hover:text-red-800"
                                                        : "text-blue-600 hover:text-blue-800"
                                                        }`}
                                                    title={`${h.label} ${locked ? '마감 해제' : '마감'}`}
                                                >
                                                    {locked ? '해제' : '마감'}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>




                                {/* --- 통계 섹션 1: 출석 현황 --- */}
                                <tr className="border-t-2 border-gray-200 bg-white">
                                    <td className="bg-white border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-white border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-2.5 px-4 bg-white border-r border-gray-100 font-bold text-gray-700 whitespace-nowrap text-sm text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">학생 출석</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const studentActive = members.filter(m => m.type === '학생' && isActive(m, h.label));
                                        const studentAttended = studentActive.filter(m => {
                                            const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                            return r[h.label] === "O";
                                        }).length;
                                        return (
                                            <td key={i} className="py-2.5 px-1 border-r border-gray-100 text-center text-base">
                                                <span className="font-bold text-blue-600 text-base">{studentAttended}</span>
                                                <span className="text-gray-400 mx-1">/</span>
                                                <span className="text-gray-500">{studentActive.length}</span>
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr className="bg-white">
                                    <td className="bg-white border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-white border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-2.5 px-4 bg-white border-r border-gray-100 font-bold text-gray-700 whitespace-nowrap text-sm text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">교사 출석</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const teacherActive = members.filter(m => m.type === '선생님' && isActive(m, h.label));
                                        const teacherAttended = teacherActive.filter(m => {
                                            const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                            return r[h.label] === "O";
                                        }).length;
                                        return (
                                            <td key={i} className="py-2.5 px-1 border-r border-gray-100 text-center text-base">
                                                <span className="font-bold text-blue-600 text-base">{teacherAttended}</span>
                                                <span className="text-gray-400 mx-1">/</span>
                                                <span className="text-gray-500">{teacherActive.length}</span>
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr className="bg-white">
                                    <td className="bg-white border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-white border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-2.5 px-1 bg-white border-r border-gray-100 font-bold text-gray-700 whitespace-nowrap text-sm text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">전체 출석</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const totalRegistered = members.filter(m => isActive(m, h.label));
                                        const totalAttended = totalRegistered.filter(m => {
                                            const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                            return r[h.label] === "O";
                                        }).length;
                                        return (
                                            <td key={i} className="py-2.5 px-1 border-r border-gray-100 text-center text-base bg-blue-50/10">
                                                <span className="font-bold text-blue-700 text-base">{totalAttended}</span>
                                                <span className="text-blue-200 mx-1">/</span>
                                                <span className="text-blue-900/50 font-semibold">{totalRegistered.length}</span>
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr className="bg-white border-t border-gray-100">
                                    <td className="bg-white border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-white border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-2.5 px-1 bg-white border-r border-gray-100 font-bold text-blue-600 whitespace-nowrap text-sm leading-tight text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        전입 전출<br /><span className="text-[10px] font-normal text-gray-400 font-normal mt-0.5">(등록/삭제)</span>
                                    </td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const transferItems = getTransferItems(h.label);
                                        return (
                                            <td key={i} className="py-2.5 px-1 border-r border-gray-100 text-center text-[11px] whitespace-pre-wrap leading-tight max-w-[80px]">
                                                {transferItems.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {transferItems.map((item, idx) => (
                                                            <div key={idx} className={item.type === '등록' ? 'text-blue-600 font-medium' : 'text-red-500 font-medium'}>
                                                                <div className="font-bold text-[13px]">{item.name}</div>
                                                                <div className="text-[10px] font-normal opacity-80">({item.date} {item.type})</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-gray-300">-</span>}
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* --- 통계 섹션 2: 결석 현황 --- */}
                                <tr className="bg-white border-t-4 border-gray-100">
                                    <td className="bg-white border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-white border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-2.5 px-4 bg-white border-r border-gray-100 font-bold text-green-600 whitespace-nowrap text-sm text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">학생 결석자</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const locked = isWeekLocked(h.label);
                                        const absentNames = members.filter(m => m.type === '학생' && isActive(m, h.label)).filter(m => {
                                            const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                            return r[h.label] !== "O";
                                        }).map(m => m.name).join('\n');
                                        return (
                                            <td key={i} className="py-2.5 px-1 border-r border-gray-100 text-center text-[13px] text-gray-400 whitespace-pre-wrap leading-tight max-w-[80px]">
                                                {locked ? <span className="text-green-600">{absentNames || '-'}</span> : '-'}
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr className="bg-white border-t border-gray-100">
                                    <td className="bg-white border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-white border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-2.5 px-1 bg-white border-r border-gray-100 font-bold text-green-600 whitespace-nowrap text-sm text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">교사 결석자</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const locked = isWeekLocked(h.label);
                                        const absentNames = members.filter(m => m.type === '선생님' && isActive(m, h.label)).filter(m => {
                                            const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                            return r[h.label] !== "O";
                                        }).map(m => m.name).join('\n');
                                        return (
                                            <td key={i} className="py-2.5 px-1 border-r border-gray-100 text-center text-[13px] text-gray-400 whitespace-pre-wrap leading-tight max-w-[80px]">
                                                {locked ? <span className="text-green-600">{absentNames || '-'}</span> : '-'}
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* --- 통계 섹션 3: 생일자 --- */}
                                <tr className="bg-white border-t-4 border-gray-100">
                                    <td className="bg-white border-r border-gray-100 min-w-[40px]"></td>
                                    <td className="bg-white border-r border-gray-100 min-w-[50px]"></td>
                                    <td className="sticky left-0 z-10 py-1.5 px-1 bg-white border-r border-gray-100 font-bold text-pink-500 whitespace-nowrap text-sm text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">생일자</td>
                                    {currentMonthRangeHeaders.map((h, i) => {
                                        const birthdayItems = getBirthdayItems(h.label);
                                        return (
                                            <td key={i} className="py-1.5 px-1 border-r border-gray-100 text-center text-[11px] text-pink-500 whitespace-pre-wrap leading-tight max-w-[80px]">
                                                {birthdayItems.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {birthdayItems.map((bp, idx) => (
                                                            <div key={idx}>
                                                                <div className="font-bold text-[13px]">{bp.name}</div>
                                                                <div className="text-[10px] font-normal opacity-80">({bp.month}-{bp.day})</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-gray-300">-</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>
            <div className="pt-4 border-t border-gray-100">
                {/* 2. 명단 추가 */}
                <Card
                    id="member-form-section"
                    title={<span className="text-lg font-semibold">{editingMemberId ? "명단 수정" : "명단 추가"}</span>}
                    right={
                        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                            {['학생', '선생님'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => {
                                        if (editingMemberId) {
                                            if (!confirm("수정 중인 내용이 사라집니다. 구분을 변경하시겠습니까?")) return;
                                        }
                                        setMemberType(t);
                                        resetMemberForm();
                                        setEditingMemberId(null);
                                    }}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${memberType === t ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    }
                >
                    <form onSubmit={handleMemberSubmit} className="space-y-4 min-h-[160px]">
                        {memberType === '학생' ? (
                            <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">학생 이름</label>
                                    <input type="text" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="학생 이름" />
                                </div>
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block uppercase">학년</label>
                                    <input type="text" value={memberForm.age} onChange={e => setMemberForm({ ...memberForm, age: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="예: 중1" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block text-blue-600">목장</label>
                                    <select
                                        value={memberForm.group}
                                        onChange={e => setMemberForm({ ...memberForm, group: e.target.value })}
                                        className="w-full rounded-xl border-blue-200 border-2 px-2 py-2 bg-blue-50/30 focus:bg-white transition-colors text-base h-11 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">목장 선택</option>
                                        {uniqueGroups.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                        <option value="목장미정">목장미정</option>
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">연락처</label>
                                    <input type="text" value={memberForm.phone} onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="010-0000-0000" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">생년월일</label>
                                    <input type="text" value={memberForm.birthdate} onChange={e => setMemberForm({ ...memberForm, birthdate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="YYYY-MM-DD" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">학교</label>
                                    <input type="text" value={memberForm.school} onChange={e => setMemberForm({ ...memberForm, school: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="학교명" />
                                </div>
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">기타(MBTI)</label>
                                    <input type="text" value={memberForm.mbti} onChange={e => setMemberForm({ ...memberForm, mbti: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="MBTI" />
                                </div>

                                {/* 2번째 줄 - 총 12컬럼 */}
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block text-blue-600 font-bold">등록일</label>
                                    <input type="date" value={memberForm.regDate} onChange={e => setMemberForm({ ...memberForm, regDate: e.target.value })} className="w-full rounded-xl border-blue-200 border px-2 py-2 bg-blue-50/30 focus:bg-white transition-colors text-base h-11 outline-none font-bold" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block font-bold">전출일(퇴소)</label>
                                    <input type="date" value={memberForm.leaveDate} onChange={e => setMemberForm({ ...memberForm, leaveDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none font-bold text-gray-900" />
                                </div>
                                <div className="col-span-1 md:col-span-4">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">사진 업로드</label>
                                    <div className="relative">
                                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-11" />
                                        <button type="button" className={`w-full h-11 rounded-xl flex items-center justify-center gap-1 border transition-all text-sm ${isUploading ? 'bg-orange-50 text-orange-500 border-orange-200' : memberForm.photoUrl ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 font-normal border-gray-300'}`}>
                                            {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={18} />}
                                            <span>사진 업로드</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="col-span-1 md:col-span-4 flex items-end">
                                    <button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-1 shadow-md font-bold text-base active:scale-95 transition-all">
                                        {editingMemberId ? <Save size={18} /> : <Plus size={18} />}
                                        <span>{editingMemberId ? "저장" : "추가"}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">선생님 이름</label>
                                    <input type="text" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="선생님 이름" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">직책</label>
                                    <input type="text" value={memberForm.position} onChange={e => setMemberForm({ ...memberForm, position: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="예: 부장" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block text-blue-600">목장</label>
                                    <select
                                        value={memberForm.group}
                                        onChange={e => setMemberForm({ ...memberForm, group: e.target.value })}
                                        className="w-full rounded-xl border-blue-200 border-2 px-2 py-2 bg-blue-50/30 focus:bg-white transition-colors text-base h-11 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">목장 선택</option>
                                        {uniqueGroups.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                        <option value="목장미정">목장미정</option>
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">연락처</label>
                                    <input type="text" value={memberForm.phone} onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="010-0000-0000" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">생일(예: 01-08)</label>
                                    <input type="text" value={memberForm.birthdate} onChange={e => setMemberForm({ ...memberForm, birthdate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="01-08" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">기타(MBTI)</label>
                                    <input type="text" value={memberForm.mbti} onChange={e => setMemberForm({ ...memberForm, mbti: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="MBTI" />
                                </div>

                                {/* 2번째 줄 */}
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block text-blue-600 font-bold">등록일</label>
                                    <input type="date" value={memberForm.regDate} onChange={e => setMemberForm({ ...memberForm, regDate: e.target.value })} className="w-full rounded-xl border-blue-200 border px-2 py-2 bg-blue-50/30 focus:bg-white transition-colors text-base h-11 outline-none font-bold" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block font-bold">전출일(퇴임)</label>
                                    <input type="date" value={memberForm.leaveDate} onChange={e => setMemberForm({ ...memberForm, leaveDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none font-bold text-gray-900" />
                                </div>
                                <div className="col-span-2 md:col-span-8 flex items-end">
                                    <button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center font-bold text-base shadow-md transition-colors active:scale-95">
                                        {editingMemberId ? <Save size={18} className="mr-1" /> : <Plus size={18} className="mr-1" />}
                                        <span>{editingMemberId ? "저장" : "추가"}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        {editingMemberId && (
                            <button type="button" onClick={() => { setEditingMemberId(null); resetMemberForm(); }} className="w-full py-2 text-base text-gray-400 underline">수정 취소</button>
                        )}
                    </form>
                </Card>
            </div>

            {/* 3. 학생명단 */}
            <Card title={
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">학생명단</span>
                    <a
                        href="https://docs.google.com/spreadsheets/d/1VHTf0AxvJ6Jx4RnTlsIJZxHdjrAESTCgOx_vMEXJlTo/edit?gid=1598655081#gid=1598655081"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                    >
                        <Table2 size={14} className="text-green-600" /> 명단 시트
                    </a>
                </div>
            }>
                <div className="relative">
                    {/* Sticky Header */}
                    <div className="sticky top-[112px] md:top-[84px] z-40 overflow-hidden bg-white -mx-4 px-4">
                        <div ref={scrollRefs.studentHeader} className="overflow-hidden scrollbar-hide">
                            <table className="w-full text-base table-fixed">
                                <colgroup>
                                    <col className="w-[40px]" />
                                    <col className="w-[70px]" />
                                    <col className="w-[90px]" />
                                    <col className="w-[50px]" />
                                    <col className="w-[70px]" />
                                    <col className="w-[75px]" />
                                    <col className="w-[110px]" />
                                    <col className="w-[105px]" />
                                    <col className="w-[60px]" />
                                    <col className="w-[95px]" />
                                    <col className="w-[100px]" />
                                    <col className="w-[50px]" />
                                </colgroup>
                                <thead className="bg-gray-50">
                                    <tr className="border-b-2 border-gray-200 text-gray-700 bg-gray-50">
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">No.</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50 uppercase text-blue-600 font-bold">목장</th>
                                        <th className="sticky left-0 z-[45] py-2.5 px-2 font-normal text-center text-base whitespace-nowrap bg-gray-50 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">이름</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">학년</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap leading-tight bg-gray-50">출석률</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap leading-tight bg-gray-50">목자</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">연락처</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">학교</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">기타</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">생년월일</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">등록/전출</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">관리</th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div ref={scrollRefs.studentBody} onScroll={(e) => handleSyncScroll(scrollRefs.studentHeader, e)} className="overflow-x-auto -mx-4 px-4 scrollbar-hide border-l-4 border-yellow-400">
                        <table className="w-full text-base table-fixed">
                            <colgroup>
                                <col className="w-[40px]" />
                                <col className="w-[70px]" />
                                <col className="w-[90px]" />
                                <col className="w-[50px]" />
                                <col className="w-[70px]" />
                                <col className="w-[75px]" />
                                <col className="w-[110px]" />
                                <col className="w-[105px]" />
                                <col className="w-[60px]" />
                                <col className="w-[95px]" />
                                <col className="w-[100px]" />
                                <col className="w-[50px]" />
                            </colgroup>
                            <thead className="invisible h-0 overflow-hidden pointer-events-none">
                                <tr>
                                    <th>No.</th>
                                    <th>목장</th>
                                    <th>이름</th>
                                    <th>학년</th>
                                    <th>출석률</th>
                                    <th>목자</th>
                                    <th>연락처</th>
                                    <th>학교</th>
                                    <th>기타</th>
                                    <th>생년월일</th>
                                    <th>등록/전출</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStudents.map((m, idx) => (
                                    <tr key={m.id} id={`list-row-${m.id}`} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-all">
                                        <td className="py-1.5 px-1 text-center text-gray-400 text-sm whitespace-nowrap">{idx + 1}</td>
                                        <td className="py-1.5 px-1 text-center font-normal text-gray-900 text-base cursor-pointer class-cell whitespace-nowrap" onClick={() => scrollToId(`gallery-member-${m.id}`)}>{m.group || "-"}</td>
                                        <td className={`sticky left-0 z-10 py-1.5 px-2 text-center font-bold text-base cursor-pointer name-cell whitespace-nowrap hover:underline bg-white/95 backdrop-blur-sm border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${isCurrentlyActive(m) ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => speedScrollTo(`attendance-row-${m.id}`)}>
                                            <div className="flex flex-col items-center justify-center leading-tight">
                                                <span className={!isCurrentlyActive(m) ? 'line-through' : ''}>{m.name}</span>
                                                {!isCurrentlyActive(m) && <span className="text-[11px] font-normal no-underline mt-0.5">{getInactiveLabel(m)}</span>}
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-base whitespace-nowrap">{m.age}</td>
                                        <td className="py-1.5 px-1 text-center text-blue-600 font-normal text-sm">
                                            {getAttendanceRate(m).split('\n').map((line, i) => (
                                                <div key={i} className="whitespace-nowrap">{line}</div>
                                            ))}
                                        </td>
                                        <td className="py-1.5 px-1 text-center text-blue-600 font-medium text-base whitespace-nowrap truncate max-w-[90px] cursor-pointer hover:underline" onClick={() => highlightTeacherByName(m.teacher)}>{m.teacher || "-"}</td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-sm whitespace-nowrap">{m.phone || "-"}</td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-sm whitespace-nowrap truncate max-w-[110px]">{m.school || "-"}</td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-sm whitespace-nowrap">{m.mbti || "-"}</td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-sm whitespace-nowrap">{m.birthdate || "-"}</td>
                                        <td className="py-1.5 px-1 text-center text-sm whitespace-nowrap">
                                            <div className="flex flex-col items-center leading-tight">
                                                <span className="text-blue-600 font-medium">{m.regDate || "-"}</span>
                                                {m.leaveDate && <span className="text-red-500 font-medium">{m.leaveDate}</span>}
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handleEditMember(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-blue-50/30 font-bold border-t-2 border-blue-100">
                                    <td colSpan={12} className="py-3 px-4 text-left text-blue-800">
                                        합계: 실인원 {sortedStudents.filter(s => isCurrentlyActive(s)).length}명
                                        <span className="text-xs font-normal text-blue-600/60 ml-1">
                                            ({`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`} 오늘 기준)
                                        </span>
                                        / 총 {sortedStudents.length}명
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>

            {/* 4. 교사명단 */}
            <Card title={
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">교사명단</span>
                    <a
                        href="https://docs.google.com/spreadsheets/d/1VHTf0AxvJ6Jx4RnTlsIJZxHdjrAESTCgOx_vMEXJlTo/edit?gid=1598655081#gid=1598655081"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                    >
                        <Table2 size={14} className="text-green-600" /> 명단 시트
                    </a>
                </div>
            }>
                <div className="relative">
                    {/* Sticky Header */}
                    <div className="sticky top-[112px] md:top-[84px] z-40 overflow-hidden bg-white -mx-4 px-4">
                        <div ref={scrollRefs.teacherHeader} className="overflow-hidden scrollbar-hide">
                            <table className="w-full text-base table-fixed">
                                <colgroup>
                                    <col className="w-[40px]" />
                                    <col className="w-[90px]" />
                                    <col className="w-[90px]" />
                                    <col className="w-[75px]" />
                                    <col className="w-[125px]" />
                                    <col className="w-[90px]" />
                                    <col className="w-[110px]" />
                                    <col className="w-[350px]" />
                                    <col className="w-[60px]" />
                                </colgroup>
                                <thead className="bg-gray-50">
                                    <tr className="border-b-2 border-gray-200 text-gray-700 bg-gray-50">
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">No.</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50 uppercase text-blue-600 font-bold">목장</th>
                                        <th className="sticky left-0 z-[45] py-2.5 px-2 font-normal text-center text-base whitespace-nowrap bg-gray-50 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">이름</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">직책</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">연락처</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">생일</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">등록/전출</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">담당 학생</th>
                                        <th className="py-2.5 px-1 font-normal text-center text-base whitespace-nowrap bg-gray-50">관리</th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div ref={scrollRefs.teacherBody} onScroll={(e) => handleSyncScroll(scrollRefs.teacherHeader, e)} className="overflow-x-auto -mx-4 px-4 scrollbar-hide border-l-4 border-blue-400">
                        <table className="w-full text-base table-fixed">
                            <colgroup>
                                <col className="w-[40px]" />
                                <col className="w-[90px]" />
                                <col className="w-[90px]" />
                                <col className="w-[75px]" />
                                <col className="w-[125px]" />
                                <col className="w-[90px]" />
                                <col className="w-[110px]" />
                                <col className="w-[350px]" />
                                <col className="w-[60px]" />
                            </colgroup>
                            <thead className="invisible h-0 overflow-hidden pointer-events-none">
                                <tr>
                                    <th>No.</th>
                                    <th>목장</th>
                                    <th>이름</th>
                                    <th>직책</th>
                                    <th>연락처</th>
                                    <th>생일</th>
                                    <th>등록/전출</th>
                                    <th>담당 학생</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTeachers.map((m, idx) => (
                                    <tr key={m.id} id={`list-row-teacher-${m.id}`} className="border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-all">
                                        <td className="py-1.5 px-1 text-center text-gray-400 text-sm whitespace-nowrap">{idx + 1}</td>
                                        <td className="py-1.5 px-1 text-center font-normal text-gray-900 text-base cursor-pointer hover:bg-blue-100/50 whitespace-nowrap" onClick={() => highlightByClass(m.group)}>{m.group || "-"}</td>
                                        <td className={`sticky left-0 z-10 py-1.5 px-2 text-center font-bold text-base whitespace-nowrap cursor-pointer hover:underline bg-white/95 backdrop-blur-sm border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${isCurrentlyActive(m) ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => speedScrollTo(`attendance-row-${m.id}`)}>
                                            <div className="flex flex-col items-center justify-center leading-tight">
                                                <span className={!isCurrentlyActive(m) ? 'line-through' : ''}>{m.name}</span>
                                                {!isCurrentlyActive(m) && <span className="text-[11px] font-normal no-underline mt-0.5">{getInactiveLabel(m)}</span>}
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-sm whitespace-nowrap truncate max-w-[80px]">{m.position}</td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-sm whitespace-nowrap">{m.phone || "-"}</td>
                                        <td className="py-1.5 px-1 text-center text-gray-600 text-sm whitespace-nowrap">{m.birthdate || "-"}</td>
                                        <td className="py-1.5 px-1 text-center text-sm whitespace-nowrap">
                                            <div className="flex flex-col items-center leading-tight">
                                                <span className="text-blue-600 font-medium">{m.regDate || "-"}</span>
                                                {m.leaveDate && <span className="text-red-500 font-medium">{m.leaveDate}</span>}
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1 text-left text-base text-gray-700 cursor-pointer" onClick={() => setExpandedTeacherStudentsId(expandedTeacherStudentsId === m.id ? null : m.id)}>
                                            <div className={`flex flex-wrap gap-x-2 gap-y-1 justify-start px-1 ${expandedTeacherStudentsId === m.id ? "" : "line-clamp-3"}`}>
                                                {String(m.assignedStudents || "-").split(',').map((s, i, arr) => (
                                                    <span key={i} className="hover:text-blue-600 hover:underline whitespace-nowrap" onClick={(e) => { e.stopPropagation(); highlightByName(s.trim()); }}>
                                                        {s.trim()}{i < arr.length - 1 ? ',' : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handleEditMember(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-blue-50/30 font-bold border-t-2 border-blue-100">
                                    <td colSpan={9} className="py-3 px-4 text-left text-blue-800">
                                        합계: 실인원 {sortedTeachers.filter(t => isCurrentlyActive(t)).length}명
                                        <span className="text-xs font-normal text-blue-600/60 ml-1">
                                            ({`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`} 오늘 기준)
                                        </span>
                                        / 총 {sortedTeachers.length}명
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card >


            {/* 5. 사진 갤러리 */}
            < div className="mt-8 space-y-4" >
                <div className="flex items-center gap-3 px-1">
                    <ImageIcon className="text-blue-600" size={24} />
                    <h3 className="text-xl font-bold">사진 갤러리</h3>
                    <a
                        href={`https://drive.google.com/drive/folders/${config.photoFolderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                    >
                        <Folder size={14} className="text-blue-600" /> 학생사진 드라이브
                    </a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {members.filter(m => m.photoUrl && isCurrentlyActive(m)).sort(sortMembers).map(m => (
                        <div key={m.id} id={`gallery-member-${m.id}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all">
                            <div className="aspect-square relative flex items-center justify-center bg-gray-50 cursor-pointer" onClick={() => window.open(m.photoUrl, '_blank')}>
                                <img
                                    src={(typeof m.photoUrl === 'string' && m.photoUrl.includes("drive.google.com") && m.photoUrl.includes("id="))
                                        ? (() => {
                                            try {
                                                const u = new URL(m.photoUrl);
                                                return `https://drive.google.com/thumbnail?id=${u.searchParams.get("id")}&sz=w800`;
                                            } catch (e) {
                                                return m.photoUrl;
                                            }
                                        })()
                                        : m.photoUrl}
                                    alt={m.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleEditMember(m); }} className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm text-blue-600 hover:bg-white transition-colors">
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                                <div className={`absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm ${m.type === '학생' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}>
                                    {m.type}
                                </div>
                            </div>
                            <div className="p-3 space-y-1 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => speedScrollTo(`list-row-${m.id}`)}>
                                <div className="flex items-center justify-between pointer-events-none">
                                    <span className="font-bold text-gray-800 text-lg">{m.name}</span>
                                    {m.age && <span className="text-gray-400 text-sm">{m.age}</span>}
                                    {m.position && <span className="text-orange-500 text-sm font-bold">{m.position}</span>}
                                </div>
                                <div className="flex items-center justify-between gap-1 pointer-events-none">
                                    <span className="text-blue-600 text-sm font-bold">{m.group && `<${m.group}>`}</span>
                                    <span className="text-xs text-gray-400 truncate">
                                        {m.type === '학생'
                                            ? (() => {
                                                const teachers = members.filter(mt => mt.type === '선생님');
                                                const matchTeacher = teachers.find(mt => mt.group === m.group);
                                                return matchTeacher
                                                    ? (matchTeacher.position && matchTeacher.position !== "교육목자" ? `${matchTeacher.position} ${matchTeacher.name}` : matchTeacher.name)
                                                    : (m.teacher || "공동체");
                                            })()
                                            : '공동체'}
                                    </span>
                                </div>

                            </div>
                        </div>
                    ))}
                </div>
            </div >
        </div >
    );
}
