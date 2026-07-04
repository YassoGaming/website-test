function insertStarfield(){
    const canvas = document.createElement('canvas');
    canvas.id = 'star-canvas';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height, cx, cy, maxRadius;

    function resize(){
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        cx = width / 2;
        cy = height / 2;
        maxRadius = Math.sqrt(width * width + height * height) / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    function randomBetween(min, max){
        return Math.random() * (max - min) + min;
    }

    // generate stars using polar coordinates (angle + distance from center)
    // this makes it easy to fly them outward from the middle during warp
    const starCount = 1560;
    const stars = [];
    for(let i = 0; i < starCount; i++){
        const x = Math.random() * width;
        const y = Math.random() * height;
        stars.push({
            angle: Math.atan2(y - cy, x - cx),
            radius: Math.sqrt((x - cx) ** 2 + (y - cy) ** 2),
            speed: randomBetween(0.5, 1.4), // gives each star a slightly different warp speed (parallax)
            size: Math.random() * 1.4 + 0.3,
            twinkleSpeed: randomBetween(0.001, 0.003),
            twinkleOffset: Math.random() * Math.PI * 2
        });
    }

    // warp state — 0 is normal drifting starfield, 1 is full hyperspace streak
    let warpIntensity = 0;
    let warpTarget = 0;

    // if we just arrived from a page transition, start already at full warp
    // and let it ease back down — makes it feel like one continuous jump
    if(sessionStorage.getItem('pageTransitioning') === '1'){
        warpIntensity = 1;
        warpTarget = 0;
        sessionStorage.removeItem('pageTransitioning');
    }

    // exposed so the page-transition click handler can trigger the effect
    window.triggerStarWarp = (target) => {
        warpTarget = target;
    };

    // comet state
    let comet = null;
    let nextCometTime = performance.now() + randomBetween(4000, 9000);

    function spawnComet(t){
        const startX = randomBetween(-100, width * 0.3);
        const startY = randomBetween(0, height * 0.35);
        const angle = randomBetween(0.3, 0.55); // travels down-right at a shallow angle
        comet = {
            startTime: t,
            duration: randomBetween(1300, 1900),
            startX,
            startY,
            dx: Math.cos(angle),
            dy: Math.sin(angle),
            distance: Math.max(width, height) * 1.3
        };
    }

    function animate(t){
        ctx.clearRect(0, 0, width, height);

        // ease warp intensity toward its target each frame (same lerp trick as the mouse tracking)
        warpIntensity += (warpTarget - warpIntensity) * 0.05;

        for(const s of stars){
            const prevRadius = s.radius;

            // stars only move when warp is active — at rest they just twinkle in place
            const moveAmount = warpIntensity * 16 * s.speed;
            s.radius += moveAmount;

            // once a star flies past the edge, respawn it near the center
            // so it can fly outward again — classic hyperspace loop
            if(s.radius > maxRadius){
                s.radius = randomBetween(0, 20);
                s.angle = Math.random() * Math.PI * 2;
            }

            const x = cx + Math.cos(s.angle) * s.radius;
            const y = cy + Math.sin(s.angle) * s.radius;

            if(warpIntensity > 0.04){
                // streaking line instead of a dot once warp kicks in
                const prevX = cx + Math.cos(s.angle) * prevRadius;
                const prevY = cy + Math.sin(s.angle) * prevRadius;

                ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + warpIntensity * 0.5})`;
                ctx.lineWidth = 1 + warpIntensity * 1.6;
                ctx.beginPath();
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(x, y);
                ctx.stroke();
            } else {
                const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
                ctx.beginPath();
                ctx.arc(x, y, s.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.65 * twinkle})`;
                ctx.fill();
            }
        }

        // comet trigger (paused visually during warp since streaks dominate anyway)
        if(!comet && t > nextCometTime && warpIntensity < 0.1){
            spawnComet(t);
        }

        if(comet){
            const elapsed = t - comet.startTime;
            const progress = elapsed / comet.duration;

            if(progress >= 1){
                comet = null;
                nextCometTime = t + randomBetween(7000, 14000);
            } else {
                const dist = progress * comet.distance;
                const cometX = comet.startX + comet.dx * dist;
                const cometY = comet.startY + comet.dy * dist;

                const tailLength = 130;
                const tx = cometX - comet.dx * tailLength;
                const ty = cometY - comet.dy * tailLength;

                const trailGradient = ctx.createLinearGradient(tx, ty, cometX, cometY);
                trailGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
                trailGradient.addColorStop(1, 'rgba(255, 255, 255, 0.85)');

                ctx.strokeStyle = trailGradient;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(cometX, cometY);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(cometX, cometY, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.shadowColor = 'rgba(0, 157, 255, 0.9)';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

function insertWaveBackground(){
    const container = document.createElement('div');
    container.className = 'wave-container';

    const canvas = document.createElement('canvas');
    canvas.id = 'wave-canvas';
    container.appendChild(canvas);
    document.body.appendChild(container);

    const ctx = canvas.getContext('2d');
    let width, height;
    let mouseX = -9999;
    let mouseY = -9999;
    let smoothMouseX = -9999;
    let smoothMouseY = -9999;

    // tsunami state
    let tsunamiActive = false;
    let tsunamiStart = 0;
    const tsunamiDuration = 3200; // how long one surge lasts, in ms
    let nextTsunamiTime = performance.now() + randomBetween(6000, 11000);

    function randomBetween(min, max){
        return Math.random() * (max - min) + min;
    }

    function resize(){
        width = canvas.width = container.offsetWidth;
        height = canvas.height = container.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    function getWavePoints(baseHeight, amplitude, freq, speed, phase, t, layerScale){
        const points = [];
        const step = 4; // smaller step = higher resolution, smoother curve

        // tsunami envelope: rises then falls over its duration, and travels left to right
        let tsunamiOffset = 0;
        if(tsunamiActive){
            const elapsed = t - tsunamiStart;
            const progress = elapsed / tsunamiDuration; // 0 to 1
            const envelope = Math.sin(Math.min(progress, 1) * Math.PI); // rises then falls, 0->1->0
            const humpCenter = -width * 0.25 + progress * width * 1.5; // travels across and past the screen
            const humpWidth = 260;

            var getTsunamiAt = (x) => {
                const dist = x - humpCenter;
                return envelope * 90 * layerScale * Math.exp(-(dist * dist) / (2 * humpWidth * humpWidth));
            };
        }

        for(let x = 0; x <= width; x += step){
            let y = baseHeight
                + Math.sin(x * freq + t * speed + phase) * amplitude
                + Math.sin(x * freq * 2.3 + t * speed * 1.4 + phase) * amplitude * 0.35
                + Math.sin(x * freq * 0.5 - t * speed * 0.6 + phase) * amplitude * 0.5;

            if(tsunamiActive){
                y -= getTsunamiAt(x);
            }

            const dx = x - smoothMouseX;
            const dy = baseHeight - smoothMouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const influence = Math.exp(-dist / 180) * 80;
            y -= influence;

            points.push({ x, y });
        }
        return points;
    }

    function drawSmoothPath(points){
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(points[0].x, points[0].y);

        // draw through midpoints so the curve flows instead of faceting at each sample
        for(let i = 0; i < points.length - 1; i++){
            const mx = (points[i].x + points[i + 1].x) / 2;
            const my = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
        }

        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.lineTo(width, height);
        ctx.closePath();
    }

    function drawWaveLayer(baseHeight, amplitude, freq, speed, phase, colorStart, colorEnd, t, layerScale){
        const points = getWavePoints(baseHeight, amplitude, freq, speed, phase, t, layerScale);
        drawSmoothPath(points);

        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    function animate(t){
        ctx.clearRect(0, 0, width, height);

        // ease the tracked mouse position toward the real one each frame
        // this is what removes the "snap" feel and makes the push glide
        smoothMouseX += (mouseX - smoothMouseX) * 0.08;
        smoothMouseY += (mouseY - smoothMouseY) * 0.08;

        // tsunami trigger/reset logic
        if(!tsunamiActive && t > nextTsunamiTime){
            tsunamiActive = true;
            tsunamiStart = t;
        }
        if(tsunamiActive && (t - tsunamiStart) > tsunamiDuration){
            tsunamiActive = false;
            nextTsunamiTime = t + randomBetween(6000, 11000);
        }

        drawWaveLayer(height * 0.55, 22, 0.005, 0.0009, 0, 'rgba(255,0,255,0.45)', 'rgba(0,157,255,0.45)', t, 0.6);
        drawWaveLayer(height * 0.68, 16, 0.007, 0.0013, 2.5, 'rgba(255,0,255,0.9)', 'rgba(0,157,255,0.9)', t, 0.85);
        drawWaveLayer(height * 0.78, 12, 0.009, 0.0017, 5, 'rgba(255,0,255,1)', 'rgba(0,157,255,1)', t, 1);

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

// Discord public badge flags (bitfield values from Discord's API)
const DISCORD_BADGES = {
    1: { label: 'Discord Staff' },
    2: { label: 'Partner' },
    4: { label: 'HypeSquad Events' },
    8: { label: 'Bug Hunter' },
    64: { label: 'HypeSquad Bravery' },
    128: { label: 'HypeSquad Brilliance' },
    256: { label: 'HypeSquad Balance' },
    512: { label: 'Early Supporter' },
    16384: { label: 'Bug Hunter Gold' },
    131072: { label: 'Early Verified Bot Dev' },
    262144: { label: 'Moderator Programs Alum' },
    4194304: { label: 'Active Developer' }
};

function getDiscordBadges(flags){
    const badges = [];
    for(const bit in DISCORD_BADGES){
        if(flags & bit){
            badges.push(DISCORD_BADGES[bit].label);
        }
    }
    return badges;
}

async function loadDiscordCard(){
    const discordId = "1433236223178051764";
    const card = document.getElementById('discord-card');
    if(!card) return;

    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
        const json = await res.json();

        if(!json.success){
            card.innerHTML = `<p>Couldn't load Discord status.</p>`;
            return;
        }

        const data = json.data;
        const user = data.discord_user;
        const status = data.discord_status;

        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}`
            : `https://cdn.discordapp.com/embed/avatars/0.png`;

        const decorationUrl = user.avatar_decoration_data
            ? `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png`
            : null;

        const statusColors = {
            online: '#23a55a',
            idle: '#f0b232',
            dnd: '#f23f43',
            offline: '#80848e'
        };

        // Badges
        const badges = getDiscordBadges(user.public_flags || 0);
        const badgesHTML = badges.length
            ? `<div class="discord-badges">${badges.map(b => `<span class="discord-badge">${b}</span>`).join('')}</div>`
            : '';

        // Server tag
        const tagHTML = (user.primary_guild && user.primary_guild.tag)
            ? `<span class="discord-server-tag">${user.primary_guild.tag}</span>`
            : '';

        // Rich presence activity (things like VS Code, games, etc — type 0)
        const activity = data.activities.find(a => a.type === 0);
        let activityHTML = '';
        if(activity){
            const largeImg = activity.assets?.large_image
                ? `https://cdn.discordapp.com/app-assets/${activity.application_id}/${activity.assets.large_image}.png`
                : null;
            activityHTML = `
                <div class="discord-activity">
                    ${largeImg ? `<img src="${largeImg}" class="activity-icon" alt="activity icon">` : ''}
                    <div>
                        <p class="activity-name">${activity.name}</p>
                        <p class="activity-details">${activity.details || ''}</p>
                    </div>
                </div>
            `;
        }

        // Spotify (separate from rich presence, comes from data.spotify directly)
        let spotifyHTML = '';
        if(data.listening_to_spotify && data.spotify){
            spotifyHTML = `
                <div class="discord-activity spotify-row">
                    <img src="${data.spotify.album_art_url}" class="activity-icon" alt="album art">
                    <div>
                        <p class="activity-name"><i class="fa-brands fa-spotify"></i> Listening to Spotify</p>
                        <p class="activity-details">${data.spotify.song} — ${data.spotify.artist}</p>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="discord-header">
                <div class="avatar-wrapper">
                    <img src="${avatarUrl}" class="discord-avatar" alt="Discord avatar">
                    ${decorationUrl ? `<img src="${decorationUrl}" class="avatar-decoration" alt="avatar decoration">` : ''}
                    <span class="status-dot" style="background:${statusColors[status]}"></span>
                </div>
                <div>
                    <p class="discord-username">${user.global_name || user.username} ${tagHTML}</p>
                    <p class="discord-tag">@${user.username}</p>
                </div>
            </div>
            ${badgesHTML}
            ${activityHTML}
            ${spotifyHTML}
        `;

    } catch(err){
        card.innerHTML = `<p>Couldn't load Discord status.</p>`;
        console.error(err);
    }
}

async function loadAboutAvatar(){
    const avatarEl = document.getElementById('about-avatar');
    if(!avatarEl) return; // only runs on about.html

    const discordId = "1433236223178051764";

    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
        const json = await res.json();
        if(!json.success) return;

        const user = json.data.discord_user;
        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}`
            : `https://cdn.discordapp.com/embed/avatars/0.png`;

        avatarEl.src = avatarUrl;
    } catch(err){
        console.error(err);
    }
}

function initPageTransitions(){
    const internalLinks = document.querySelectorAll('a[href$=".html"]');

    internalLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if(link.target === '_blank') return; // don't intercept new-tab links

            e.preventDefault();
            const destination = link.getAttribute('href');

            if(window.triggerStarWarp){
                window.triggerStarWarp(1); // ramp stars up to full light-speed streaks
            }
            sessionStorage.setItem('pageTransitioning', '1'); // tells the next page to start already at warp speed

            setTimeout(() => {
                window.location.href = destination;
            }, 650); // gives the warp streaks time to build up before the page actually changes
        });
    });
}

insertStarfield();
// insertWaveBackground(); // temporarily disabled
loadDiscordCard();
loadAboutAvatar();
initPageTransitions();