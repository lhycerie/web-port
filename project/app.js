import { createShader } from 'shaders/js'

const isMobile = window.matchMedia('(max-width: 992px)').matches ||
    window.matchMedia('(pointer: coarse)').matches ||
    (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

async function initShader() {
    // on mobile, completely disable webgl shader canvas to ensure smooth 60/120fps scrolling
    if (isMobile) {
        const canvas = document.getElementById("canvas");
        if (canvas) canvas.style.display = 'none';
        return;
    }

    const canvas = document.getElementById("canvas");
    if (!canvas) return;

    // ensure layout has computed dimensions
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    try {
        const shader = await createShader(canvas, {
            components: [
                {
                    type: 'Dither',
                    id: 'idmv7n54kin7msnnzzn',
                },
                {
                    type: 'ChromaFlow',
                    id: 'idmv7n5mg239rmnao2p',
                    props: {
                        baseColor: '#A174FA',
                        downColor: '#FF8844',
                        leftColor: '#93DF36',
                        rightColor: '#72D8F4',
                        upColor: '#72D8F4',
                    },
                }
            ]
        });

        // pause shader rendering when hero leaves viewport so scrolling down has 100% free gpu
        if (shader && typeof shader.pause === 'function' && typeof shader.resume === 'function') {
            const heroObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        shader.resume();
                    } else {
                        shader.pause();
                    }
                });
            }, { threshold: 0.05 });

            heroObserver.observe(canvas);

            // pause when tab is hidden to conserve battery and system memory
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    shader.pause();
                } else {
                    const rect = canvas.getBoundingClientRect();
                    if (rect.bottom > 0 && rect.top < window.innerHeight) {
                        shader.resume();
                    }
                }
            });
        }

        window.addEventListener('resize', () => {
            if (shader && typeof shader.resize === 'function') {
                shader.resize();
            }
        });
    } catch {
        // fallback without throwing unhandled exceptions
    }
}

function initStatementScrollReveal() {
    const section = document.getElementById('statement');
    const container = document.getElementById('statement-text');
    if (!section || !container) return;

    const wordEls = container.querySelectorAll('.statement-word');
    if (!wordEls.length) return;

    // on reduced motion, words are fully visible immediately without scroll loop overhead
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        wordEls.forEach(el => el.style.opacity = '1');
        return;
    }

    const totalWords = wordEls.length;
    let ticking = false;

    function update() {
        const textRect = container.getBoundingClientRect();
        const vh = window.innerHeight;
        const textCenter = textRect.top + textRect.height * 0.5;

        // reveal window as text approaches center from bottom:
        // textcenter starts revealing from vh * 0.88 down to vh * 0.54 (fully revealed near center)
        const enterProgress = Math.min(1, Math.max(0, (vh * 0.88 - textCenter) / (vh * 0.34)));

        // unreveal window as text leaves center towards top:
        // textcenter stays fully revealed until vh * 0.46, then unreveals down to vh * 0.14
        const exitProgress = Math.min(1, Math.max(0, (textCenter - vh * 0.14) / (vh * 0.32)));

        // active visibility progress: reveals on enter, unreveals on exit or scrolling in reverse
        const activeProgress = Math.min(enterProgress, exitProgress);

        wordEls.forEach((el, i) => {
            // stagger each word sequentially across the progress span
            const startP = i / (totalWords + 1);
            const endP = (i + 2) / (totalWords + 1);
            const wordProgress = Math.min(1, Math.max(0, (activeProgress - startP) / (endP - startP)));

            // map to opacity: dim (0.16) to fully revealed (1.0)
            const opacity = (0.16 + wordProgress * 0.84).toFixed(3);
            el.style.opacity = opacity;
        });

        // parallax drift for floating assets as user scrolls (desktop only to prevent mobile repaint churn)
        if (!isMobile) {
            const scrollOffset = (vh * 0.5 - textCenter);
            const behindAssets = section.querySelectorAll('.asset-behind');
            behindAssets.forEach((asset, idx) => {
                const speed = idx === 0 ? 0.08 : -0.06;
                asset.style.setProperty('--scroll-shift', `${scrollOffset * speed}px`);
            });

            const scatteredAssets = section.querySelectorAll('.asset-scattered');
            scatteredAssets.forEach((asset, idx) => {
                const speeds = [0.12, -0.09, 0.14, -0.11, 0.07];
                const speed = speeds[idx % speeds.length];
                asset.style.setProperty('--scroll-shift', `${scrollOffset * speed}px`);
            });
        }

        ticking = false;
    }

    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }

    // use lenis scroll event on desktop to avoid duplicate triggers, fallback to window scroll
    if (window.lenis) {
        window.lenis.on('scroll', onScroll);
    } else {
        window.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', onScroll, { passive: true });
    update();
}

function initLenisAndGraphicsScroll() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lenis = null;

    // run lenis on desktop only
    if (typeof Lenis !== 'undefined' && !reducedMotion && !isMobile) {
        lenis = new Lenis({
            duration: 1.0,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 1,
        });

        window.lenis = lenis;

        // drive lenis via dedicated requestanimationframe loop for native 60/120/144hz vsync
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }

    function scrollToHash(immediate = true) {
        const hash = window.location.hash;
        if (!hash || hash === '#' || hash === '') return;

        if (hash === '#hero') {
            if (lenis) {
                lenis.scrollTo(0, { immediate: true });
            } else {
                window.scrollTo({ top: 0, left: 0, behavior: immediate ? 'instant' : 'smooth' });
            }
            return;
        }

        try {
            const target = document.querySelector(hash);
            if (target) {
                if (lenis) {
                    lenis.scrollTo(target, { offset: -20, immediate });
                } else {
                    target.scrollIntoView({ behavior: immediate ? 'instant' : 'smooth' });
                }
            }
        } catch {
            // ignore non-element hash
        }
    }

    // smooth anchor scrolling for local # links and index.html# links
    document.querySelectorAll('a[href^="#"], a[href^="index.html#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const rawHref = this.getAttribute('href');
            if (!rawHref) return;
            const hashIndex = rawHref.indexOf('#');
            if (hashIndex === -1) return;
            const hash = rawHref.slice(hashIndex);
            if (hash && hash !== '#') {
                const target = document.querySelector(hash);
                if (target) {
                    e.preventDefault();
                    if (window.location.hash !== hash) {
                        history.pushState(null, '', hash);
                    }
                    const offset = (target.id === 'hero' || hash === '#hero') ? 0 : -20;
                    if (lenis) {
                        lenis.scrollTo(target, { offset });
                    } else {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        });
    });

    if (window.location.hash) {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        scrollToHash(true);

        window.addEventListener('load', () => {
            setTimeout(() => scrollToHash(true), 120);
        });
    }

    window.addEventListener('hashchange', () => {
        scrollToHash(false);
    });

    if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);

        if (lenis) {
            lenis.on('scroll', ScrollTrigger.update);
        }

        // graphics section: move a little bit to the left as user scrolls
        const graphicsSection = document.getElementById('graphics');
        const tracks = document.querySelectorAll('.graphics-track');

        if (graphicsSection && tracks.length && !reducedMotion) {
            const isSmallScreen = window.matchMedia('(max-width: 992px)').matches || isMobile;
            const shift1 = isSmallScreen ? -140 : -180;
            const shift2 = isSmallScreen ? -200 : -240;
            const scrubVal = isSmallScreen ? 0.6 : 1;

            // row 1 moves to the left
            if (tracks[0]) {
                gsap.fromTo(tracks[0],
                    { x: 0 },
                    {
                        x: shift1,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: graphicsSection,
                            start: 'top bottom',
                            end: 'bottom top',
                            scrub: scrubVal,
                            invalidateOnRefresh: true,
                        }
                    }
                );
            }

            // row 2 moves to the left with subtle parallax offset
            if (tracks[1]) {
                gsap.fromTo(tracks[1],
                    { x: isSmallScreen ? -15 : -30 },
                    {
                        x: shift2,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: graphicsSection,
                            start: 'top bottom',
                            end: 'bottom top',
                            scrub: scrubVal,
                            invalidateOnRefresh: true,
                        }
                    }
                );
            }
        }
    } else if (lenis) {
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }
}

function initRoleCursorFollower() {
    const follower = document.getElementById('role-cursor-follower');
    const followerImg = document.getElementById('role-cursor-img');
    const roleItems = document.querySelectorAll('.role-item');

    if (!follower || !followerImg || !roleItems.length) return;

    // preload svg assets for zero-latency instant rendering
    const assets = [
        'assets/purple-flower.svg',
        'assets/blue-wave.svg',
        'assets/orange-blob.svg',
        'assets/green-flower.svg'
    ];
    assets.forEach((src) => {
        const img = new Image();
        img.src = src;
    });

    // continuously align follower with cursor
    window.addEventListener('pointermove', (e) => {
        follower.style.left = `${e.clientX}px`;
        follower.style.top = `${e.clientY}px`;
    }, { passive: true });

    roleItems.forEach((item) => {
        const assetSrc = item.getAttribute('data-cursor-asset');

        item.addEventListener('pointerenter', (e) => {
            if (assetSrc) {
                followerImg.src = assetSrc;
                follower.style.left = `${e.clientX}px`;
                follower.style.top = `${e.clientY}px`;
                follower.classList.add('active');
            }
        });

        item.addEventListener('pointerleave', (e) => {
            const nextEl = e.relatedTarget;
            // only hide follower if not moving into another role item
            if (!nextEl || !nextEl.closest('.role-item')) {
                follower.classList.remove('active');
            }
        });
    });

    document.addEventListener('mouseleave', () => {
        follower.classList.remove('active');
    });
}

function initProjectFilesAnimation() {
    const projectCards = document.querySelectorAll('.projects-grid .project-card');
    const projectsTitle = document.querySelector('.projects-display-title');
    if (!projectCards.length && !projectsTitle) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !window.gsap) {
        if (projectsTitle) {
            projectsTitle.style.opacity = '1';
            projectsTitle.style.transform = 'none';
        }
        projectCards.forEach((card) => {
            card.style.opacity = '1';
            card.style.transform = 'none';
        });
        return;
    }

    if (window.ScrollTrigger && !reducedMotion) {
        // entrance animation for projects title
        if (projectsTitle) {
            gsap.fromTo(projectsTitle,
                { opacity: 0, y: isMobile ? 20 : 35 },
                {
                    opacity: 1,
                    y: 0,
                    duration: isMobile ? 0.55 : 0.8,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: projectsTitle,
                        start: isMobile ? 'top 92%' : 'top 88%',
                        once: true,
                    }
                }
            );
        }

        // batch entrance for cards
        gsap.set(projectCards, {
            opacity: 0,
            y: isMobile ? 24 : 70,
            scale: isMobile ? 0.98 : 0.94,
        });

        ScrollTrigger.batch(projectCards, {
            start: isMobile ? 'top 90%' : 'top 85%',
            once: true,
            onEnter: (batch) => {
                gsap.to(batch, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: isMobile ? 0.6 : 0.85,
                    ease: 'power3.out',
                    stagger: isMobile ? 0.08 : 0.16,
                    onComplete: () => {
                        batch.forEach((card) => {
                            gsap.set(card, { clearProps: 'transform,opacity,scale' });
                        });
                    }
                });
            }
        });

        window.addEventListener('load', () => {
            ScrollTrigger.refresh();
        });
    }
}

function initRoleItemsAnimation() {
    const roleItems = document.querySelectorAll('.roles-list .role-item, .roles-list .roles-cta');
    const expTitle = document.querySelector('#experience .section-display-title');
    if (!roleItems.length && !expTitle) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !window.gsap) {
        if (expTitle) {
            expTitle.style.opacity = '1';
            expTitle.style.transform = 'none';
        }
        roleItems.forEach((item) => {
            item.style.opacity = '1';
            item.style.transform = 'none';
        });
        return;
    }

    if (window.ScrollTrigger && !reducedMotion) {
        // experience section title animation
        if (expTitle) {
            gsap.fromTo(expTitle,
                { opacity: 0, y: isMobile ? 20 : 35 },
                {
                    opacity: 1,
                    y: 0,
                    duration: isMobile ? 0.55 : 0.8,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: expTitle,
                        start: isMobile ? 'top 92%' : 'top 88%',
                        once: true,
                    }
                }
            );
        }

        // role items batch entrance
        gsap.set(roleItems, {
            opacity: 0,
            y: isMobile ? 22 : 50,
            scale: isMobile ? 0.98 : 0.96,
        });

        ScrollTrigger.batch(roleItems, {
            start: isMobile ? 'top 90%' : 'top 88%',
            once: true,
            onEnter: (batch) => {
                gsap.to(batch, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: isMobile ? 0.6 : 0.8,
                    ease: 'power3.out',
                    stagger: isMobile ? 0.07 : 0.14,
                    onComplete: () => {
                        batch.forEach((item) => {
                            gsap.set(item, { clearProps: 'transform,opacity,scale' });
                        });
                    }
                });
            }
        });
    }
}

function initGraphicsSectionAnimation() {
    const graphicsSection = document.getElementById('graphics');
    const graphicsTitle = document.querySelector('#graphics .section-display-title');
    const galleryButton = document.querySelector('#graphics .graphics-cta .btn-primary');
    if (!graphicsSection) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !window.gsap || !window.ScrollTrigger) {
        if (graphicsTitle) {
            graphicsTitle.style.opacity = '1';
            graphicsTitle.style.transform = 'none';
        }
        if (galleryButton) {
            galleryButton.style.opacity = '1';
            galleryButton.style.transform = 'none';
        }
        return;
    }

    // graphics section title and button entrance
    if (graphicsTitle) {
        gsap.fromTo(graphicsTitle,
            { opacity: 0, y: isMobile ? 20 : 35 },
            {
                opacity: 1,
                y: 0,
                duration: isMobile ? 0.55 : 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: graphicsTitle,
                    start: isMobile ? 'top 92%' : 'top 88%',
                    once: true,
                }
            }
        );
    }

    if (galleryButton) {
        gsap.fromTo(galleryButton,
            { opacity: 0, y: isMobile ? 20 : 35, scale: isMobile ? 0.98 : 0.94 },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: isMobile ? 0.55 : 0.8,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: galleryButton,
                    start: isMobile ? 'top 92%' : 'top 90%',
                    once: true,
                },
                onComplete: () => {
                    gsap.set(galleryButton, { clearProps: 'transform,opacity,scale' });
                }
            }
        );
    }
}

function initCertificatesAnimation() {
    const certCards = document.querySelectorAll('.certs-grid .cert-card');
    const certsTitle = document.querySelector('#certs .section-display-title');
    if (!certCards.length && !certsTitle) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !window.gsap) {
        if (certsTitle) {
            certsTitle.style.opacity = '1';
            certsTitle.style.transform = 'none';
        }
        certCards.forEach((card) => {
            card.style.opacity = '1';
            card.style.transform = 'none';
        });
        return;
    }

    if (window.ScrollTrigger && !reducedMotion) {
        // certs section title animation
        if (certsTitle) {
            gsap.fromTo(certsTitle,
                { opacity: 0, y: isMobile ? 20 : 35 },
                {
                    opacity: 1,
                    y: 0,
                    duration: isMobile ? 0.55 : 0.8,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: certsTitle,
                        start: isMobile ? 'top 92%' : 'top 88%',
                        once: true,
                    }
                }
            );
        }

        // cert cards batch entrance
        gsap.set(certCards, {
            opacity: 0,
            y: isMobile ? 24 : 65,
            scale: isMobile ? 0.98 : 0.94,
        });

        ScrollTrigger.batch(certCards, {
            start: isMobile ? 'top 90%' : 'top 85%',
            once: true,
            onEnter: (batch) => {
                gsap.to(batch, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: isMobile ? 0.6 : 0.85,
                    ease: 'power3.out',
                    stagger: isMobile ? 0.08 : 0.16,
                    onComplete: () => {
                        batch.forEach((card) => {
                            gsap.set(card, { clearProps: 'transform,opacity,scale' });
                        });
                    }
                });
            }
        });
    }
}

function initGithubContributions() {
    const grid = document.getElementById('github-contribution-grid');
    if (!grid) return;

    const activityUrl = 'https://github-contributions-api.jogruber.de/v4/lhycerie?y=last';

    function createDay(level = 0, label = '') {
        const day = document.createElement('span');
        day.className = 'github-contribution-day';
        day.dataset.level = String(Math.min(4, Math.max(0, Number(level) || 0)));
        if (label) day.title = label;
        return day;
    }

    const loadingFragment = document.createDocumentFragment();
    for (let index = 0; index < 371; index += 1) {
        loadingFragment.appendChild(createDay());
    }
    grid.classList.add('is-loading');
    grid.replaceChildren(loadingFragment);

    fetch(activityUrl)
        .then((response) => {
            if (!response.ok) throw new Error(`Contribution request failed: ${response.status}`);
            return response.json();
        })
        .then((data) => {
            if (!Array.isArray(data.contributions) || !data.contributions.length) {
                throw new Error('No contribution data returned');
            }

            const contributions = data.contributions.slice(-371);
            const contributionFragment = document.createDocumentFragment();
            const dateFormatter = new Intl.DateTimeFormat('en', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });

            contributions.forEach((entry) => {
                const count = Number(entry.count) || 0;
                const date = new Date(`${entry.date}T00:00:00`);
                const label = `${count} ${count === 1 ? 'contribution' : 'contributions'} on ${dateFormatter.format(date)}`;
                contributionFragment.appendChild(createDay(entry.level, label));
            });

            const total = Number(data.total?.lastYear)
                || Object.values(data.total || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
            const summaryText = `${total.toLocaleString()} public ${total === 1 ? 'contribution' : 'contributions'} in the last year`;

            grid.classList.remove('is-loading');
            grid.replaceChildren(contributionFragment);
            grid.setAttribute('aria-busy', 'false');
            grid.setAttribute('aria-label', `${summaryText} for GitHub user lhycerie`);

            const scroller = grid.closest('.github-chart-scroll');
            if (scroller && scroller.scrollWidth > scroller.clientWidth) {
                scroller.scrollLeft = scroller.scrollWidth;
            }
        })
        .catch(() => {
            grid.classList.remove('is-loading');
            grid.setAttribute('aria-busy', 'false');
            grid.setAttribute('aria-label', 'GitHub contribution history is currently unavailable');
        });
}

function initAboutAnimation() {
    const aboutSection = document.getElementById('about');
    if (!aboutSection) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const aboutCards = aboutSection.querySelectorAll('.about-primary-row > *, .about-grid .feature-card');
    const aboutExtras = aboutSection.querySelectorAll('.marquee-section, #github-history');
    const aboutTitle = aboutSection.querySelector('.section-display-title');

    if (reducedMotion || !window.gsap) {
        if (aboutTitle) {
            aboutTitle.style.opacity = '1';
            aboutTitle.style.transform = 'none';
        }
        aboutCards.forEach((card) => {
            card.style.opacity = '1';
            card.style.transform = 'none';
        });
        aboutExtras.forEach((extra) => {
            extra.style.opacity = '1';
            extra.style.transform = 'none';
        });
        return;
    }

    if (window.ScrollTrigger && !reducedMotion) {
        // about section title animation
        if (aboutTitle) {
            gsap.fromTo(aboutTitle,
                { opacity: 0, y: isMobile ? 20 : 35 },
                {
                    opacity: 1,
                    y: 0,
                    duration: isMobile ? 0.55 : 0.8,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: aboutTitle,
                        start: isMobile ? 'top 92%' : 'top 88%',
                        once: true,
                    }
                }
            );
        }

        if (aboutCards.length) {
            gsap.set(aboutCards, {
                opacity: 0,
                y: isMobile ? 24 : 65,
                scale: isMobile ? 0.98 : 0.95,
            });

            ScrollTrigger.batch(aboutCards, {
                start: isMobile ? 'top 90%' : 'top 86%',
                once: true,
                onEnter: (batch) => {
                    gsap.to(batch, {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        duration: isMobile ? 0.6 : 0.85,
                        ease: 'power3.out',
                        stagger: isMobile ? 0.08 : 0.14,
                        onComplete: () => {
                            batch.forEach((card) => {
                                gsap.set(card, { clearProps: 'transform,opacity,scale' });
                            });
                        }
                    });
                }
            });
        }

        if (aboutExtras.length) {
            gsap.set(aboutExtras, {
                opacity: 0,
                y: isMobile ? 20 : 45,
            });

            ScrollTrigger.batch(aboutExtras, {
                start: isMobile ? 'top 92%' : 'top 88%',
                once: true,
                onEnter: (batch) => {
                    gsap.to(batch, {
                        opacity: 1,
                        y: 0,
                        duration: isMobile ? 0.55 : 0.8,
                        ease: 'power3.out',
                        stagger: isMobile ? 0.08 : 0.16,
                        onComplete: () => {
                            batch.forEach((extra) => {
                                gsap.set(extra, { clearProps: 'transform,opacity' });
                            });
                        }
                    });
                }
            });
        }
    }
}

function initContactAnimation() {
    const contactSection = document.getElementById('contact');
    if (!contactSection) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const contactButtons = contactSection.querySelectorAll('.contact-actions a');
    const contactTitle = contactSection.querySelector('.contact-cta-title');
    const contactCopyLines = contactSection.querySelectorAll('.contact-copy-line');

    if (reducedMotion || !window.gsap) {
        if (contactTitle) {
            contactTitle.style.opacity = '1';
            contactTitle.style.transform = 'none';
        }
        contactCopyLines.forEach((line) => {
            line.style.opacity = '1';
            line.style.transform = 'none';
        });
        contactButtons.forEach((btn) => {
            btn.style.opacity = '1';
            btn.style.transform = 'none';
        });
        return;
    }

    if (window.ScrollTrigger && !reducedMotion) {
        // contact animations
        if (contactTitle) {
            gsap.fromTo(contactTitle,
                { opacity: 0, y: isMobile ? 20 : 40 },
                {
                    opacity: 1,
                    y: 0,
                    duration: isMobile ? 0.6 : 0.85,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: contactTitle,
                        start: isMobile ? 'top 90%' : 'top 86%',
                        once: true,
                    }
                }
            );
        }

        if (contactCopyLines.length) {
            gsap.fromTo(contactCopyLines,
                { opacity: 0, y: isMobile ? 18 : 30 },
                {
                    opacity: 1,
                    y: 0,
                    duration: isMobile ? 0.55 : 0.8,
                    ease: 'power2.out',
                    stagger: isMobile ? 0.06 : 0.1,
                    scrollTrigger: {
                        trigger: contactCopyLines[0],
                        start: isMobile ? 'top 92%' : 'top 88%',
                        once: true,
                    },
                    onComplete: () => {
                        gsap.set(contactCopyLines, { clearProps: 'transform,opacity' });
                    }
                }
            );
        }

        if (contactButtons.length) {
            gsap.set(contactButtons, {
                opacity: 0,
                y: isMobile ? 18 : 35,
                scale: isMobile ? 0.98 : 0.94,
            });

            ScrollTrigger.batch(contactButtons, {
                start: isMobile ? 'top 90%' : 'top 86%',
                once: true,
                onEnter: (batch) => {
                    gsap.to(batch, {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        duration: isMobile ? 0.55 : 0.8,
                        ease: 'power3.out',
                        stagger: isMobile ? 0.08 : 0.15,
                        onComplete: () => {
                            batch.forEach((btn) => {
                                gsap.set(btn, { clearProps: 'transform,opacity,scale' });
                            });
                        }
                    });
                }
            });
        }
    }
}

function initAll() {
    initShader();
    initLenisAndGraphicsScroll();
    initStatementScrollReveal();
    initRoleCursorFollower();
    initAboutAnimation();
    initProjectFilesAnimation();
    initRoleItemsAnimation();
    initGraphicsSectionAnimation();
    initCertificatesAnimation();
    initContactAnimation();
    initGithubContributions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}
