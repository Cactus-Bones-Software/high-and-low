import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDOM } from './test-utils.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 6: Offline Capabilities & Service Worker (Task 6.1, 6.2, 6.3)', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('1. Service worker file (public/sw.js) exists and contains precache assets', () => {
        const serviceWorkerPath = path.join(process.cwd(), 'public', 'sw.js');
        expect(fs.existsSync(serviceWorkerPath)).toBe(true);

        const serviceWorkerContent = fs.readFileSync(serviceWorkerPath, 'utf-8');
        expect(serviceWorkerContent).toContain('high-and-low-');
        expect(serviceWorkerContent).toContain('/index.html');
        expect(serviceWorkerContent).toContain('/style.css');
        expect(serviceWorkerContent).toContain('/manifest.json');
        expect(serviceWorkerContent).toContain('/favicon.ico');
        expect(serviceWorkerContent).toContain('/pwa-192x192.png');
        expect(serviceWorkerContent).toContain('/pwa-512x512.png');
        expect(serviceWorkerContent).toContain('/js/main.js');
        expect(serviceWorkerContent).toContain('/sw.js');
    });

    it('2. Service worker registers on window load event or via registerServiceWorker', async () => {
        let registeredPath = null;
        let registeredOptions = null;
        windowInstance.navigator.serviceWorker.register = vi.fn().mockImplementation((serviceWorkerScriptPath, options) => {
            registeredPath = serviceWorkerScriptPath;
            registeredOptions = options;
            return Promise.resolve({
                scope: './',
                installing: null,
                waiting: null,
                active: null,
                addEventListener: vi.fn(),
                update: vi.fn().mockResolvedValue(undefined)
            });
        });

        await windowInstance.registerServiceWorker();

        expect(registeredPath).toBe('sw.js');
        expect(registeredOptions).toEqual({ scope: './' });
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
        expect(iconSources.some(src => src.endsWith('pwa-192x192.png'))).toBe(true);
        expect(iconSources.some(src => src.endsWith('pwa-512x512.png'))).toBe(true);
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

    it('5. Service worker lifecycle monitors installing worker state and prompts on update (Task 6.3)', () => {
        const registrationListeners = new Map();
        const mockRegistration = {
            scope: './',
            installing: null,
            addEventListener: vi.fn((eventName, callback) => {
                registrationListeners.set(eventName, callback);
            }),
            update: vi.fn().mockResolvedValue(undefined)
        };

        const mockInstallingWorkerListeners = new Map();
        const mockInstallingWorker = {
            state: 'installing',
            addEventListener: vi.fn((eventName, callback) => {
                mockInstallingWorkerListeners.set(eventName, callback);
            })
        };

        windowInstance.setupServiceWorkerLifecycle(mockRegistration);

        // Simulate updatefound with active controller
        Object.defineProperty(windowInstance.navigator.serviceWorker, 'controller', {
            value: { state: 'activated' },
            configurable: true
        });

        mockRegistration.installing = mockInstallingWorker;
        const updateFoundCallback = registrationListeners.get('updatefound');
        expect(updateFoundCallback).toBeDefined();
        updateFoundCallback();

        // Simulate worker reaching 'installed' state
        mockInstallingWorker.state = 'installed';
        const stateChangeCallback = mockInstallingWorkerListeners.get('statechange');
        expect(stateChangeCallback).toBeDefined();
        stateChangeCallback();

        const dialogTitleElement = documentInstance.getElementById('notice-dialog-title');
        expect(dialogTitleElement.textContent).toContain('Update');
    });

    it('6. controllerchange event triggers active tab reload (Task 6.3)', () => {
        const serviceWorkerListeners = new Map();
        vi.spyOn(windowInstance.navigator.serviceWorker, 'addEventListener').mockImplementation((eventName, callback) => {
            serviceWorkerListeners.set(eventName, callback);
        });

        const mockRegistration = {
            scope: './',
            installing: null,
            addEventListener: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined)
        };

        let reloadTriggered = false;
        windowInstance.reloadActiveTab = vi.fn(() => {
            reloadTriggered = true;
        });

        windowInstance.setupServiceWorkerLifecycle(mockRegistration);

        const controllerChangeCallback = serviceWorkerListeners.get('controllerchange');
        expect(controllerChangeCallback).toBeDefined();
        controllerChangeCallback();

        expect(reloadTriggered).toBe(true);
    });

    it('7. visibilitychange and focus trigger registration.update() lifecycle re-checks (Task 6.3)', () => {
        const mockRegistration = {
            scope: './',
            installing: null,
            addEventListener: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined)
        };

        windowInstance.setupServiceWorkerLifecycle(mockRegistration);

        // Trigger visibilitychange with visible state
        Object.defineProperty(documentInstance, 'visibilityState', {
            value: 'visible',
            configurable: true
        });
        documentInstance.dispatchEvent(new windowInstance.Event('visibilitychange'));

        expect(mockRegistration.update).toHaveBeenCalledTimes(1);

        // Trigger window focus
        windowInstance.dispatchEvent(new windowInstance.Event('focus'));
        expect(mockRegistration.update).toHaveBeenCalledTimes(2);
    });
});
