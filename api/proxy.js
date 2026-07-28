// api/proxy.js
export default async function handler(req, res) {
    // نسمح فقط بطلبات GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const seat = req.query.seat;
    if (!seat || !/^\d+$/.test(seat)) {
        return res.status(400).json({ error: 'رقم الجلوس مطلوب ويجب أن يكون أرقاماً فقط' });
    }

    const targetUrl = `https://than.nezakr.net/?system=s1&t=glos&k=${seat}`;

    try {
        // نجلب الصفحة من موقع نذاكر
        const response = await fetch(targetUrl, {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ar-EG,ar;q=0.9",
        "Referer": "https://than.nezakr.net/",
        "Origin": "https://than.nezakr.net"
    },
    redirect: "follow"
});

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        // نعيد محتوى الصفحة كـ HTML (نفس النص)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'فشل جلب البيانات من الموقع الخارجي: ' + error.message });
    }
}
