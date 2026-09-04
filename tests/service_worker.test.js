import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDOM } from './test-utils.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 6: Offline Capabilities & Service Worker (Task 6.1 & 6.2)', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('1. Service worker file (public/sw.js) exists and contains precache assets', () => {
        const swPath = path.join(process.cwd(), 'public', 'sw.js');
        expect(fs.existsSync(swPath)).toBe(true);

        const swContent = fs.readFileSync(swPath, 'utf-8');
        expect(swContent).toContain('high-and-low-');
        expect(swContent).toContain('/index.html');
        expect(swContent).toContain('/style.css');
        expect(swContent).toContain('/manifest.json');
        expect(swContent).toContain('/favicon.ico');
        expect(swContent).toContain('/pwa-192x192.png');
        expect(swContent).toContain('/pwa-512x512.png');
        expect(swContent).toContain('/js/main.js');
    });

    it('2. Service worker registers on window load event or via registerServiceWorker', async () => {
        let registeredPath = null;
        windowInstance.navigator.serviceWorker.register = vi.fn().mockImplementation((swScriptPath) => {
            registeredPath = swScriptPath;
            return Promise.resolve({ scope: '/' });
        });

        await windowInstance.registerServiceWorker();

        expect(registeredPath).toBe('/sw.js');
    });

    it('3. Web App Manifest exists with required PWA standalone parameters and icons', () => {
        const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
        expect(fs.existsSync(manifestPath)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        expect(manifest.name).toBe('High & Low');
        expect(manifest.short_name).toBe('High & Low');
        expect(manifest.display).toBe('standalone');
        expect(manifest.theme_color).toBe('#121212');
        expect(manifest.background_color).toBe('#121212');
        expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

        const iconSources = manifest.icons.map(icon => icon.src);
        expect(iconSources).toContain('/pwa-192x192.png');
        expect(iconSources).toContain('/pwa-512x512.png');
    });

    it('4. index.html links to manifest, favicon, and mobile meta headers', () => {
        const manifestLink = documentInstance.querySelector('link[rel="manifest"]');
        expect(manifestLink).toBeTruthy();
        expect(manifestLink.getAttribute('href')).toBe('manifest.json');

        const faviconLink = documentInstance.querySelector('link[rel="icon"]');
        expect(faviconLink).toBeTruthy();

        const appleTouchIcon = documentInstance.querySelector('link[rel="apple-touch-icon"]');
        expect(appleTouchIcon).toBeTruthy();
    });
});
