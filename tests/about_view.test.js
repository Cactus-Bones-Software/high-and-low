import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, isElementInert } from './test-utils.js';

describe('Task 2.14: About, Licence & Thank-You View Tests', () => {
    let _windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const environment = await setupTestDOM();
        _windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('1. Canvas Structure: about-canvas exists, starts inert, and is hidden off-screen', () => {
        const aboutCanvas = documentInstance.getElementById('about-canvas');
        expect(aboutCanvas).not.toBeNull();
        expect(aboutCanvas.classList.contains('app-canvas')).toBe(true);
        expect(aboutCanvas.classList.contains('view-canvas')).toBe(true);
        expect(aboutCanvas.classList.contains('view-hidden-right')).toBe(true);
        expect(isElementInert(aboutCanvas)).toBe(true);
    });

    it('2. Drawer Navigation: Drawer includes About button that navigates cleanly to about-canvas', () => {
        const menuButton = documentInstance.getElementById('button-menu');
        const sideDrawer = documentInstance.getElementById('side-drawer');
        const aboutNavButton = documentInstance.querySelector('.drawer-nav-button[data-target="about-canvas"]');

        expect(aboutNavButton).not.toBeNull();

        // Open navigation drawer
        menuButton.click();
        expect(documentInstance.body.classList.contains('drawer-open')).toBe(true);

        // Click About button
        aboutNavButton.click();

        // Drawer should close, about canvas becomes active
        const aboutCanvas = documentInstance.getElementById('about-canvas');
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');

        expect(documentInstance.body.classList.contains('drawer-open')).toBe(false);
        expect(isElementInert(sideDrawer)).toBe(true);
        expect(aboutCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(aboutCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
        expect(aboutNavButton.classList.contains('active')).toBe(true);
    });

    it('3. Back Navigation: Back button on about-canvas returns to tracker-canvas', () => {
        const aboutNavButton = documentInstance.querySelector('.drawer-nav-button[data-target="about-canvas"]');
        aboutNavButton.click();

        const aboutCanvas = documentInstance.getElementById('about-canvas');
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        expect(aboutCanvas.classList.contains('view-active')).toBe(true);

        const backButton = aboutCanvas.querySelector('.canvas-back-button[data-close-view]');
        expect(backButton).not.toBeNull();
        backButton.click();

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);
        expect(aboutCanvas.classList.contains('view-hidden-right')).toBe(true);
        expect(isElementInert(aboutCanvas)).toBe(true);
    });

    it('4. Content Verification: Contains privacy, no-ads, AGPL, donation links, and thank-you sections', () => {
        const aboutCanvas = documentInstance.getElementById('about-canvas');
        const textContent = aboutCanvas.textContent;

        // App title
        expect(textContent).toContain('High & Low');

        // On-device privacy
        expect(textContent).toMatch(/device/i);
        expect(textContent).toMatch(/no accounts/i);

        // No tracking / no advertisements
        expect(textContent).toMatch(/no advertisements|zero advertisements/i);
        expect(textContent).toMatch(/no tracking|zero tracking/i);

        // AGPL license notice and link
        expect(textContent).toMatch(/AGPL/i);
        const sourceLink = aboutCanvas.querySelector('a[href*="github.com/Cactus-Bones-Software/high-and-low"]');
        expect(sourceLink).not.toBeNull();

        // Subtle donation links
        const githubSponsorsLink = aboutCanvas.querySelector('a[href*="github.com/sponsors"]');
        const kofiLink = aboutCanvas.querySelector('a[href*="ko-fi.com"]');
        expect(githubSponsorsLink).not.toBeNull();
        expect(kofiLink).not.toBeNull();

        // Thank-You list section
        expect(textContent).toMatch(/thank you/i);
        const thankYouList = documentInstance.getElementById('about-thank-you-list');
        expect(thankYouList).not.toBeNull();
    });

    it('5. Terminology Compliance: Does not use forbidden words in user-facing copy', () => {
        const aboutCanvas = documentInstance.getElementById('about-canvas');
        const rawContent = aboutCanvas.textContent.toLowerCase();

        // Forbidden terms per docs/decisions.md & docs/glossary.md:
        // "Session", "Quiz", "Test", "Log"
        expect(rawContent).not.toMatch(/\bsession\b/);
        expect(rawContent).not.toMatch(/\bquiz\b/);
        expect(rawContent).not.toMatch(/\btest\b/);
        expect(rawContent).not.toMatch(/\blog\b/);
    });
});
