const https = require('https');

https.get('https://cremeria-ocho.vercel.app', (res) => {
    let data = '';
    res.on('data', (d) => {
        data += d;
    });
    res.on('end', () => {
        const matches = data.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|svg|webp)/gi);
        console.log(matches ? [...new Set(matches)].join('\n') : 'No images found.');

        // Let's also search for <link rel="icon" ...> or similar tags
        const linkMatches = data.match(/<link[^>]+(?:rel=["'](?:icon|apple-touch-icon|manifest)["'])[^>]*>/gi);
        console.log("LINKS:");
        console.log(linkMatches ? linkMatches.join('\n') : "no links found.");
    });
});
