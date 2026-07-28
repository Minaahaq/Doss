// api/proxy.js - CommonJS style for Vercel
const fetch = require('node-fetch'); // Vercel provides fetch globally, but we keep it safe

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const seat = req.query.seat;
    if (!seat || !/^\d+$/.test(seat)) {
        return res.status(400).json({ error: 'رقم الجلوس مطلوب وأرقام فقط' });
    }

    const targetUrl = `https://than.nezakr.net/?system=s1&t=glos&k=${seat}`;

    // قائمة محاولات: مباشرة ثم بروكسيات
    const attempts = [
        async () => {
            // المحاولة المباشرة
            const resp = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
                    'Referer': 'https://than.nezakr.net/',
                    'Origin': 'https://than.nezakr.net'
                },
                timeout: 10000
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.text();
        },
        async () => {
            // المحاولة عبر بروكسي allorigins
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
            const resp = await fetch(proxyUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            if (!resp.ok) throw new Error(`AllOrigins HTTP ${resp.status}`);
            return await resp.text();
        },
        async () => {
            // المحاولة عبر corsproxy.io
            const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
            const resp = await fetch(proxyUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            if (!resp.ok) throw new Error(`CorsProxy HTTP ${resp.status}`);
            return await resp.text();
        },
        async () => {
            // المحاولة عبر api.cors.lol
            const proxyUrl = `https://api.cors.lol/?url=${encodeURIComponent(targetUrl)}`;
            const resp = await fetch(proxyUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            if (!resp.ok) throw new Error(`CorsLol HTTP ${resp.status}`);
            return await resp.text();
        }
    ];

    let lastError = '';
    for (let i = 0; i < attempts.length; i++) {
        try {
            const html = await attempts[i]();
            // تأكد من وجود محتوى
            if (html.length < 100) throw new Error('استجابة فارغة أو قصيرة جداً');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(html);
        } catch (err) {
            lastError = err.message;
            console.warn(`محاولة ${i+1} فشلت:`, err);
        }
    }

    // كل المحاولات فشلت
    res.status(500).json({
        error: `فشل جلب البيانات من كل المصادر. آخر خطأ: ${lastError}`,
        details: 'تأكد من اتصال الإنترنت أو حاول لاحقاً.'
    });
};
