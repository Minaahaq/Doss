/* ============================================================
   SCRIPT.JS — بوابة نتائج الطلاب
   ============================================================
   جميع الوظائف المنطقية — قراءة Excel، البحث، عرض النتائج،
   الطباعة، PDF، المشاركة، والتنبيهات.
   ============================================================ */

'use strict';

// ============================================================
// 1. الإعدادات العامة
// ============================================================

const CONFIG = {
    EXCEL_FILE: 'results.xlsx',
    // المجموع الكلي الافتراضي — يمكن تغييره بسهولة
    DEFAULT_TOTAL: 650,
    STORAGE_KEY: 'resultsExcelData',
    GRADE_THRESHOLDS: [
        { min: 95, label: 'ممتاز', class: 'passed' },
        { min: 85, label: 'جيد جداً', class: 'passed' },
        { min: 75, label: 'جيد', class: 'passed' },
        { min: 65, label: 'مقبول', class: 'passed' },
        { min: 0,  label: 'راسب', class: 'failed' }
    ]
};

// أسماء الأعمدة المعروفة وتسمياتها العربية
const KNOWN_COLUMNS = {
    seating_no: 'رقم الجلوس',
    arabic_name: 'الاسم',
    branch_codes1: 'الشعبة',
    branch_code: 'الشعبة',
    branch: 'الشعبة',
    total_degree: 'المجموع الكلي',
    total: 'المجموع الكلي'
};

// الأعمدة التي يتم استثناؤها من جدول المواد
const NON_SUBJECT_COLUMNS = [
    'seating_no', 'arabic_name', 'english_name',
    'branch_codes1', 'branch_code', 'branch',
    'total_degree', 'total'
];

// ============================================================
// 2. DOM References
// ============================================================

const DOM = {
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    resultSection: document.getElementById('resultSection'),
    statusBadge: document.getElementById('statusBadge'),
    statusText: document.getElementById('statusText'),
    studentName: document.getElementById('studentName'),
    studentSeatNo: document.getElementById('studentSeatNo'),
    studentBranch: document.getElementById('studentBranch'),
    gradesBody: document.getElementById('gradesBody'),
    totalDegree: document.getElementById('totalDegree'),
    percentage: document.getElementById('percentage'),
    grade: document.getElementById('grade'),
    errorSection: document.getElementById('errorSection'),
    retryBtn: document.getElementById('retryBtn'),
    printBtn: document.getElementById('printBtn'),
    pdfBtn: document.getElementById('pdfBtn'),
    shareBtn: document.getElementById('shareBtn'),
    copyBtn: document.getElementById('copyBtn'),
    newSearchBtn: document.getElementById('newSearchBtn'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    year: document.getElementById('year'),
    toastContainer: document.getElementById('toastContainer'),
    confettiCanvas: document.getElementById('confettiCanvas')
};

// ============================================================
// 3. الحالة العامة (State)
// ============================================================

let excelData = null;       // جميع صفوف Excel
let headers = [];           // أسماء الأعمدة
let isSearching = false;
let totalMax = CONFIG.DEFAULT_TOTAL;

// ============================================================
// 4. الوظائف المساعدة
// ============================================================

/**
 * عرض Toast احترافي
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * عرض/إخفاء الـ Loading
 */
function showLoading(show = true) {
    DOM.loadingSpinner.classList.toggle('hidden', !show);
    isSearching = show;
}

/**
 * الحصول على تسمية العمود بالعربية
 */
function getColumnLabel(colName) {
    const lower = colName.toLowerCase().trim();
    return KNOWN_COLUMNS[lower] || colName.replace(/_/g, ' ');
}

/**
 * تحديد ما إذا كان العمود يمثل مادة دراسية
 */
function isSubjectColumn(colName) {
    const lower = colName.toLowerCase().trim();
    return !NON_SUBJECT_COLUMNS.includes(lower);
}

/**
 * حساب التقدير بناءً على النسبة المئوية
 */
function calculateGrade(percentage) {
    if (percentage === null || percentage === undefined || isNaN(percentage)) {
        return { label: '—', class: '' };
    }
    for (const threshold of CONFIG.GRADE_THRESHOLDS) {
        if (percentage >= threshold.min) {
            return threshold;
        }
    }
    return { label: 'راسب', class: 'failed' };
}

/**
 * حساب النسبة المئوية
 */
function calculatePercentage(total, maxTotal) {
    if (!total || !maxTotal || maxTotal <= 0) return null;
    return (total / maxTotal) * 100;
}

/**
 * تنسيق النسبة المئوية
 */
function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return `${value.toFixed(2)}%`;
}

/**
 * تنسيق الرقم بالأرقام العربية
 */
function formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return Number(value).toLocaleString('ar-EG');
}

// ============================================================
// 5. تحميل وقراءة ملف Excel
// ============================================================

/**
 * تحميل ملف Excel باستخدام Fetch ومكتبة SheetJS
 */
async function loadExcelFile() {
    try {
        // 1. استخدام البيانات المخزنة في الذاكرة أولاً
        if (excelData && headers.length > 0) {
            return { data: excelData, headers };
        }

        // 2. محاولة التحميل من localStorage
        const cached = loadFromCache();
        if (cached) {
            excelData = cached.data;
            headers = cached.headers;
            return cached;
        }

        // 3. تحميل الملف عبر Fetch
        showToast('جاري تحميل ملف النتائج...', 'info', 2000);
        const response = await fetch(CONFIG.EXCEL_FILE);
        if (!response.ok) {
            throw new Error(`فشل تحميل الملف (${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // قراءة أول شيت
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // تحويل إلى JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
            throw new Error('ملف Excel فارغ');
        }

        headers = Object.keys(jsonData[0]);
        excelData = jsonData;

        // حفظ في الذاكرة المؤقتة
        saveToCache(excelData, headers);

        // تحديد المجموع الكلي
        findTotalMaxColumn(headers, jsonData);

        console.log(`✅ تم تحميل ${jsonData.length} طالب بنجاح`);
        return { data: excelData, headers };
    } catch (error) {
        console.error('❌ خطأ في تحميل Excel:', error);
        throw error;
    }
}

/**
 * تخزين البيانات في localStorage
 */
function saveToCache(data, cols) {
    try {
        const cacheData = {
            data: data,
            headers: cols,
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
        console.warn('⚠️ تعذر حفظ النسخة المؤقتة:', e.message);
    }
}

/**
 * تحميل البيانات من localStorage
 */
function loadFromCache() {
    try {
        const cached = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!cached) return null;

        const parsed = JSON.parse(cached);
        if (!parsed.data || !parsed.headers || !parsed.timestamp) return null;

        // انتهاء الصلاحية بعد 30 دقيقة
        const thirtyMin = 30 * 60 * 1000;
        if (Date.now() - parsed.timestamp > thirtyMin) {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            return null;
        }

        return { data: parsed.data, headers: parsed.headers };
    } catch (e) {
        return null;
    }
}

/**
 * البحث عن عمود total / total_degree لتحديد أقصى مجموع
 */
function findTotalMaxColumn(cols, data) {
    const totalCol = cols.find(c =>
        c.toLowerCase().includes('total') ||
        c.toLowerCase().includes('المجموع')
    );

    if (totalCol && data.length > 0) {
        const allTotals = data
            .map(row => parseFloat(row[totalCol]))
            .filter(v => !isNaN(v) && v > 0);

        if (allTotals.length > 0) {
            totalMax = Math.max(...allTotals);
        }
    }
}

// ============================================================
// 6. البحث عن الطالب
// ============================================================

/**
 * البحث الخطي عن طالب برقم الجلوس — O(n) مع تحسين
 */
function findStudent(seatNo) {
    if (!excelData || !headers) return null;

    const searchValue = String(seatNo).trim();

    for (const row of excelData) {
        const rowSeat = String(row['seating_no'] || '').trim();
        if (rowSeat === searchValue) {
            return row;
        }
    }

    return null;
}

// ============================================================
// 7. عرض النتيجة
// ============================================================

/**
 * عرض بيانات الطالب في بطاقة النتيجة
 */
function displayResult(studentData) {
    const seatNo = studentData['seating_no'] || '—';
    const name = studentData['arabic_name'] || '—';
    const branch = studentData['branch_codes1'] ||
                   studentData['branch_code'] ||
                   studentData['branch'] || '—';

    DOM.studentName.textContent = name;
    DOM.studentSeatNo.textContent = seatNo;
    DOM.studentBranch.textContent = branch;

    displayGrades(studentData);

    const totals = calculateTotals(studentData);
    DOM.totalDegree.textContent = totals.total !== null ? formatNumber(totals.total) : '—';

    const percentage = calculatePercentage(totals.total, totalMax);
    DOM.percentage.textContent = formatPercentage(percentage);

    const gradeInfo = calculateGrade(percentage);
    DOM.grade.textContent = gradeInfo.label;

    const isPassed = gradeInfo.class === 'passed';
    DOM.statusBadge.className = `status-badge ${isPassed ? 'passed' : 'failed'}`;
    DOM.statusBadge.innerHTML = `
        <i class="fas ${isPassed ? 'fa-check-circle' : 'fa-times-circle'}"></i>
        <span>${isPassed ? 'ناجح' : 'راسب'}</span>
    `;

    DOM.errorSection.classList.add('hidden');
    DOM.resultSection.classList.remove('hidden');

    if (isPassed) {
        launchConfetti();
    }

    DOM.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * عرض جدول الدرجات
 */
function displayGrades(studentData) {
    const subjects = getSubjectGrades(studentData);

    if (subjects.length === 0) {
        DOM.gradesBody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; color: var(--text-secondary);">
                    لا توجد مواد متاحة
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    for (const subj of subjects) {
        html += `
            <tr>
                <td>${subj.label}</td>
                <td style="font-weight: 600;">${formatNumber(subj.grade)}</td>
            </tr>
        `;
    }

    DOM.gradesBody.innerHTML = html;
}

/**
 * استخراج درجات المواد من بيانات الطالب
 */
function getSubjectGrades(studentData) {
    const subjects = [];

    for (const col of headers) {
        if (!isSubjectColumn(col)) continue;

        const label = getColumnLabel(col);
        const value = parseFloat(studentData[col]);

        if (!isNaN(value)) {
            subjects.push({ label, grade: value, column: col });
        }
    }

    return subjects;
}

/**
 * حساب المجموع الكلي للطالب
 */
function calculateTotals(studentData) {
    // 1. البحث عن عمود total_degree
    const totalCol = headers.find(c =>
        c.toLowerCase() === 'total_degree' ||
        c.toLowerCase() === 'total'
    );

    if (totalCol) {
        const totalVal = parseFloat(studentData[totalCol]);
        if (!isNaN(totalVal)) {
            return { total: totalVal };
        }
    }

    // 2. جمع درجات المواد يدوياً
    let sum = 0;
    let hasGrades = false;

    for (const col of headers) {
        if (!isSubjectColumn(col)) continue;
        const value = parseFloat(studentData[col]);
        if (!isNaN(value)) {
            sum += value;
            hasGrades = true;
        }
    }

    return { total: hasGrades ? sum : null };
}

// ============================================================
// 8. إظهار رسالة الخطأ
// ============================================================

function showError() {
    DOM.resultSection.classList.add('hidden');
    DOM.errorSection.classList.remove('hidden');
    DOM.errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================================
// 9. إعادة تعيين العرض
// ============================================================

function resetView() {
    DOM.resultSection.classList.add('hidden');
    DOM.errorSection.classList.add('hidden');
    DOM.searchInput.value = '';
    DOM.searchInput.focus();
}

// ============================================================
// 10. وظيفة البحث الرئيسية
// ============================================================

async function performSearch() {
    const seatNo = DOM.searchInput.value.trim();

    if (!seatNo) {
        showToast('يرجى إدخال رقم الجلوس', 'error');
        DOM.searchInput.focus();
        return;
    }

    if (isSearching) return;

    showLoading(true);

    try {
        if (!excelData) {
            await loadExcelFile();
        }

        const student = findStudent(seatNo);

        if (student) {
            displayResult(student);
        } else {
            showError();
            showToast('رقم الجلوس غير موجود', 'error');
        }
    } catch (error) {
        console.error('❌ خطأ في البحث:', error);
        showToast('حدث خطأ: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================================
// 11. Confetti (ألعاب نارية احتفالية)
// ============================================================

function launchConfetti() {
    const canvas = DOM.confettiCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const particles = [];
    const particleCount = 200;

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.8,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 14,
            vy: -Math.random() * 16 - 2,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            opacity: 1,
            gravity: 0.3,
            friction: 0.97
        });
    }

    let animationId;
    const startTime = Date.now();
    const duration = 4000;

    function animate() {
        const elapsed = Date.now() - startTime;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let active = false;

        for (const p of particles) {
            if (elapsed > duration) {
                p.opacity -= 0.02;
            }

            if (p.opacity <= 0) continue;

            active = true;

            p.vx *= p.friction;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;

            const shapeType = Math.floor(Math.random() * 3);
            if (shapeType === 0) {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else if (shapeType === 1) {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * p.size / 2;
                    const y = Math.sin(angle) * p.size / 2;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }

        if (active) {
            animationId = requestAnimationFrame(animate);
        }
    }

    cancelAnimationFrame(animationId);
    animate();

    setTimeout(() => {
        cancelAnimationFrame(animationId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, duration + 500);
}

// ============================================================
// 12. طباعة النتيجة
// ============================================================

function printResult() {
    if (DOM.resultSection.classList.contains('hidden')) {
        showToast('لا توجد نتيجة للطباعة', 'error');
        return;
    }
    window.print();
}

// ============================================================
// 13. تحميل PDF
// ============================================================

async function downloadPDF() {
    if (DOM.resultSection.classList.contains('hidden')) {
        showToast('لا توجد نتيجة لتحميل PDF', 'error');
        return;
    }

    showToast('جاري إنشاء ملف PDF...', 'info', 2000);

    try {
        const element = DOM.resultSection.querySelector('.result-card');

        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: null,
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        const studentName = DOM.studentName.textContent || 'result';
        pdf.save(`result-${studentName}.pdf`);

        showToast('تم تحميل PDF بنجاح', 'success');
    } catch (error) {
        console.error('❌ PDF error:', error);
        showToast('فشل إنشاء PDF', 'error');
    }
}

// ============================================================
// 14. مشاركة النتيجة
// ============================================================

async function shareResult() {
    if (DOM.resultSection.classList.contains('hidden')) {
        showToast('لا توجد نتيجة للمشاركة', 'error');
        return;
    }

    const name = DOM.studentName.textContent;
    const seatNo = DOM.studentSeatNo.textContent;
    const total = DOM.totalDegree.textContent;
    const percent = DOM.percentage.textContent;
    const gradeVal = DOM.grade.textContent;

    const shareText = `📚 نتيجة الطالب: ${name}\n` +
                      `🆔 رقم الجلوس: ${seatNo}\n` +
                      `📊 المجموع: ${total}\n` +
                      `📈 النسبة: ${percent}\n` +
                      `🏆 التقدير: ${gradeVal}\n\n` +
                      `— بوابة نتائج الطلاب`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `نتيجة الطالب: ${name}`,
                text: shareText
            });
            showToast('تمت المشاركة بنجاح', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                fallbackShare(shareText);
            }
        }
    } else {
        fallbackShare(shareText);
    }
}

/**
 * نسخ النتيجة إلى الحافظة (بديل المشاركة)
 */
function fallbackShare(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('تم نسخ النتيجة — يمكنك مشاركتها الآن', 'success');
    }).catch(() => {
        showToast('تعذرت المشاركة', 'error');
    });
}

// ============================================================
// 15. نسخ النتيجة
// ============================================================

function copyResult() {
    if (DOM.resultSection.classList.contains('hidden')) {
        showToast('لا توجد نتيجة للنسخ', 'error');
        return;
    }

    const name = DOM.studentName.textContent;
    const seatNo = DOM.studentSeatNo.textContent;
    const branch = DOM.studentBranch.textContent;
    const total = DOM.totalDegree.textContent;
    const percent = DOM.percentage.textContent;
    const gradeVal = DOM.grade.textContent;

    const text = `📋 نتيجة الطالب\n` +
                 `━━━━━━━━━━━━━━━━\n` +
                 `👤 الاسم: ${name}\n` +
                 `🆔 رقم الجلوس: ${seatNo}\n` +
                 `📌 الشعبة: ${branch}\n` +
                 `📊 المجموع: ${total}\n` +
                 `📈 النسبة: ${percent}\n` +
                 `🏆 التقدير: ${gradeVal}\n` +
                 `━━━━━━━━━━━━━━━━\n` +
                 `بوابة نتائج الطلاب`;

    navigator.clipboard.writeText(text).then(() => {
        showToast('تم نسخ النتيجة بنجاح', 'success');
    }).catch(() => {
        showToast('تعذر نسخ النتيجة', 'error');
    });
}

// ============================================================
// 16. الوضع الليلي (Dark Mode)
// ============================================================

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    const icon = DOM.darkModeToggle.querySelector('i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const icon = DOM.darkModeToggle.querySelector('i');
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ============================================================
// 17. منع إدخال الحروف في رقم الجلوس
// ============================================================

function setupInputValidation() {
    DOM.searchInput.addEventListener('input', function () {
        this.value = this.value.replace(/[^\d]/g, '');
    });

    DOM.searchInput.addEventListener('keydown', function (e) {
        // السماح فقط بالأرقام ومسموحات التحكم
        const allowedKeys = [
            'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
            'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'
        ];

        if (allowedKeys.includes(e.key)) return;
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) return;
        if (e.key === 'c' && (e.ctrlKey || e.metaKey)) return;
        if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return;
        if (e.key === 'x' && (e.ctrlKey || e.metaKey)) return;

        if (!/^\d$/.test(e.key)) {
            e.preventDefault();
        }
    });
}

// ============================================================
// 18. تهيئة أحداث المستمعين (Event Listeners)
// ============================================================

function setupEventListeners() {
    // زر البحث
    DOM.searchBtn.addEventListener('click', performSearch);

    // البحث بالضغط على Enter
    DOM.searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });

    // أزرار النتيجة
    DOM.printBtn.addEventListener('click', printResult);
    DOM.pdfBtn.addEventListener('click', downloadPDF);
    DOM.shareBtn.addEventListener('click', shareResult);
    DOM.copyBtn.addEventListener('click', copyResult);
    DOM.newSearchBtn.addEventListener('click', resetView);

    // إعادة البحث بعد الخطأ
    DOM.retryBtn.addEventListener('click', function () {
        DOM.errorSection.classList.add('hidden');
        DOM.searchInput.focus();
    });

    // الوضع الليلي
    DOM.darkModeToggle.addEventListener('click', toggleDarkMode);

    // تحديث تاريخ السنة في الفوتر
    DOM.year.textContent = new Date().getFullYear();
}

// ============================================================
// 19. تشغيل التطبيق
// ============================================================

function initApp() {
    console.log('🚀 تشغيل بوابة نتائج الطلاب...');

    // تحميل الثيم
    loadTheme();

    // إعداد التحقق من الإدخال
    setupInputValidation();

    // إعداد الأحداث
    setupEventListeners();

    // تحميل البيانات بشكل مسبق (خلفي)
    loadExcelFile()
        .then(() => {
            console.log('✅ تم تحميل البيانات بنجاح');
            showToast('تم تجهيز قاعدة البيانات', 'success', 2000);
        })
        .catch(error => {
            console.warn('⚠️ لم يتم تحميل البيانات مسبقاً:', error.message);
        });

    // معالجة تغيير حجم النافذة للـ Confetti
    window.addEventListener('resize', () => {
        DOM.confettiCanvas.width = window.innerWidth;
        DOM.confettiCanvas.height = window.innerHeight;
    });
}

// ============================================================
// 20. بدء التطبيق
// ============================================================

document.addEventListener('DOMContentLoaded', initApp);

