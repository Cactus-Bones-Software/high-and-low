/**
 * HIGH & LOW - SETTINGS & MENU UI
 * Side navigation drawer, accessibility configuration, theme synchronization, and canvas back buttons.
 */

import { getConfig, setConfig } from '../storage/db.js';
import { navigateTo, getCurrentViewId } from './navigation.js';
import { updateHoldActionAriaLabels, setIsHoldDelayEnabled } from './hold-actions.js';
import { startNewCheckIn } from '../checkin.js';
import { safeRAF } from '../utils.js';

export function syncMetaThemeColor(themeValue) {
    const metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) return;
    const isDark = themeValue === 'dark' || (themeValue === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    metaTag.setAttribute('content', isDark ? '#121212' : '#f2f2f7');
}

export function setInert(element, isInert) {
    if (!element) return;
    element.inert = isInert;
    if (isInert) {
        element.setAttribute('inert', '');
    } else {
        element.removeAttribute('inert');
    }
}

export function openDrawer() {
    document.body.classList.add('drawer-open');
    const drawer = document.getElementById('side-drawer');
    if (drawer) setInert(drawer, false);
    const menuButton = document.getElementById('button-menu');
    if (menuButton) menuButton.setAttribute('aria-expanded', 'true');

    // Make all canvases inert while drawer is open
    document.querySelectorAll('.app-canvas').forEach(canvas => {
        setInert(canvas, true);
    });

    // Focus active or first button in drawer
    if (drawer) {
        const activeNavButton = drawer.querySelector('.drawer-nav-button.active') || drawer.querySelector('.drawer-nav-button');
        if (activeNavButton) activeNavButton.focus({ preventScroll: true });
    }
}

export function closeDrawer() {
    document.body.classList.remove('drawer-open');
    const drawer = document.getElementById('side-drawer');
    if (drawer) setInert(drawer, true);
    const menuButton = document.getElementById('button-menu');
    if (menuButton) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.focus({ preventScroll: true });
    }

    // Restore active canvas interactive state
    const currentViewId = getCurrentViewId ? getCurrentViewId() : 'tracker-canvas';
    const currentCanvas = document.getElementById(currentViewId);
    if (currentCanvas) {
        setInert(currentCanvas, false);
    }
}

export function openSettings() {
    navigateTo('settings-canvas');
}

export function closeSettings() {
    navigateTo('tracker-canvas');
}

export function setupCanvasBackButtons() {
    document.querySelectorAll('[data-close-view]').forEach(button => {
        button.addEventListener('click', () => navigateTo('tracker-canvas'));
    });
}

export function setupSettingsAndMenu() {
    const themeSelect = document.getElementById('theme-select');
    const drawerThemeSelect = document.getElementById('drawer-theme-select');
    const contrastSelect = document.getElementById('contrast-select');
    const holdDelaySelect = document.getElementById('hold-delay-select');
    const handednessSelect = document.getElementById('handedness-select');

    const handleThemeChange = async (themeValue) => {
        document.body.setAttribute('data-theme', themeValue);
        await setConfig('theme', themeValue);
        syncMetaThemeColor(themeValue);
        if (themeSelect) themeSelect.value = themeValue;
        if (drawerThemeSelect) drawerThemeSelect.value = themeValue;
    };

    if (themeSelect) {
        themeSelect.addEventListener('change', (event) => handleThemeChange(event.target.value));
    }
    if (drawerThemeSelect) {
        drawerThemeSelect.addEventListener('change', (event) => handleThemeChange(event.target.value));
    }

    if (contrastSelect) {
        contrastSelect.addEventListener('change', async (event) => {
            document.body.setAttribute('data-contrast', event.target.value);
            await setConfig('contrast', event.target.value);
        });
    }

    const handleHoldDelayChange = async (holdDelayValue) => {
        const isHoldDelayEnabled = (holdDelayValue !== 'disabled');
        setIsHoldDelayEnabled(isHoldDelayEnabled);
        document.body.setAttribute('data-hold-delay', isHoldDelayEnabled ? 'enabled' : 'disabled');
        updateHoldActionAriaLabels();
        await setConfig('holdDelay', isHoldDelayEnabled ? 'enabled' : 'disabled');
        try {
            localStorage.setItem('holdDelay', isHoldDelayEnabled ? 'enabled' : 'disabled');
        } catch (error) {
            console.warn('Failed to persist holdDelay setting to localStorage:', error);
        }
        if (holdDelaySelect) holdDelaySelect.value = isHoldDelayEnabled ? 'enabled' : 'disabled';
    };

    if (holdDelaySelect) {
        holdDelaySelect.addEventListener('change', (event) => handleHoldDelayChange(event.target.value));
    }

    // Debug bounds functionality (Console controllable: window.setDebugBounds(true/false) or window.toggleDebugBounds())
    window.setDebugBounds = async (enable) => {
        const isEnabled = Boolean(enable);
        document.body.setAttribute('data-debug-bounds', isEnabled ? 'true' : 'false');
        await setConfig('debug-bounds', isEnabled ? 'on' : 'off');
        try {
            localStorage.setItem('debug-bounds', isEnabled ? 'on' : 'off');
        } catch (error) {
            console.warn('Failed to persist debug-bounds setting to localStorage:', error);
        }
        console.log(`[Layout Rig Outlines] ${isEnabled ? 'Enabled' : 'Disabled'}`);
        return isEnabled;
    };

    window.toggleDebugBounds = (enable) => {
        if (enable !== undefined) {
            return window.setDebugBounds(enable);
        }
        const currentState = document.body.getAttribute('data-debug-bounds') === 'true';
        return window.setDebugBounds(!currentState);
    };

    const handleHandednessChange = async (handednessValue) => {
        document.body.classList.add('suppress-transitions');
        document.body.setAttribute('data-handedness', handednessValue);
        document.body.setAttribute('data-menu-side', handednessValue);
        try {
            localStorage.setItem('handedness', handednessValue);
        } catch (error) {
            console.warn('Failed to persist handedness setting to localStorage:', error);
        }
        await setConfig('handedness', handednessValue);
        if (handednessSelect) handednessSelect.value = handednessValue;
        safeRAF(() => {
            safeRAF(() => {
                if (typeof document !== 'undefined' && document.body) {
                    document.body.classList.remove('suppress-transitions');
                }
            });
        });
    };

    if (handednessSelect) {
        handednessSelect.addEventListener('change', (event) => handleHandednessChange(event.target.value));
    }

    // Dynamic listener for OS system theme changes
    if (window.matchMedia) {
        const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = () => {
            syncMetaThemeColor('system');
            if (document.body.getAttribute('data-theme') === 'system') {
                const inputBox = document.getElementById('input-box');
                if (inputBox) {
                    const currentCurve = inputBox.getAttribute('data-curve');
                    inputBox.setAttribute('data-curve', currentCurve);
                }
                const previewBox = document.getElementById('question-preview');
                if (previewBox) {
                    const previewCurve = previewBox.getAttribute('data-curve');
                    previewBox.setAttribute('data-curve', previewCurve);
                }
            }
        };

        if (systemThemeMedia.addEventListener) {
            systemThemeMedia.addEventListener('change', handleSystemThemeChange);
        }
    }

    // Toggle menu drawer
    const menuButton = document.getElementById('button-menu');
    if (menuButton) {
        menuButton.addEventListener('click', () => {
            if (document.body.classList.contains('drawer-open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        });
    }

    const closeDrawerButton = document.getElementById('button-close-drawer');
    if (closeDrawerButton) {
        closeDrawerButton.addEventListener('click', closeDrawer);
    }

    const overlay = document.getElementById('drawer-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeDrawer);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('drawer-open')) {
            closeDrawer();
        }
    });

    // Drawer Navigation Items
    document.querySelectorAll('.drawer-nav-button').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            if (targetId) {
                navigateTo(targetId);
                closeDrawer();
            }
        });
    });

    // Drawer Actions: Restart Check-In
    const restartCheckinButton = document.getElementById('button-restart-checkin');
    if (restartCheckinButton) {
        restartCheckinButton.addEventListener('click', () => {
            closeDrawer();
            navigateTo('tracker-canvas');
            void startNewCheckIn();
        });
    }
}

export async function applyStoredDisplay() {
    const [
        theme,
        contrast,
        handedness,
        legacyMenuSide,
        holdDelay
    ] = await Promise.all([
        getConfig('theme'),
        getConfig('contrast'),
        getConfig('handedness'),
        getConfig('menuSide'),
        getConfig('holdDelay'),
        getConfig('debug-bounds')
    ]);
    const themeValue = theme || 'system';
    document.body.setAttribute('data-theme', themeValue);
    syncMetaThemeColor(themeValue);
    const themeSelect = document.getElementById('theme-select');
    const drawerThemeSelect = document.getElementById('drawer-theme-select');
    if (themeSelect) themeSelect.value = themeValue;
    if (drawerThemeSelect) drawerThemeSelect.value = themeValue;

    if (contrast) {
        document.body.setAttribute('data-contrast', contrast);
        const contrastSelect = document.getElementById('contrast-select');
        if (contrastSelect) contrastSelect.value = contrast;
    }

    let localHoldDelay = null;
    try {
        localHoldDelay = localStorage.getItem('holdDelay');
    } catch (error) {
        console.warn('Failed to read holdDelay setting from localStorage:', error);
    }
    const finalHoldDelay = holdDelay || localHoldDelay || 'enabled';
    const isHoldDelayEnabled = (finalHoldDelay !== 'disabled');
    setIsHoldDelayEnabled(isHoldDelayEnabled);
    document.body.setAttribute('data-hold-delay', isHoldDelayEnabled ? 'enabled' : 'disabled');
    updateHoldActionAriaLabels();
    const holdDelaySelect = document.getElementById('hold-delay-select');
    if (holdDelaySelect) holdDelaySelect.value = isHoldDelayEnabled ? 'enabled' : 'disabled';

    let localHandedness = null;
    let localLegacyMenuSide = null;
    try {
        localHandedness = localStorage.getItem('handedness');
        localLegacyMenuSide = localStorage.getItem('menuSide');
    } catch (error) {
        console.warn('Failed to read handedness setting from localStorage:', error);
    }
    const finalHandedness = handedness || legacyMenuSide || localHandedness || localLegacyMenuSide || 'right';
    document.body.setAttribute('data-handedness', finalHandedness);
    document.body.setAttribute('data-menu-side', finalHandedness);
    if (!handedness) {
        await setConfig('handedness', finalHandedness);
    }
    try {
        localStorage.setItem('handedness', finalHandedness);
    } catch (error) {
        console.warn('Failed to initialize handedness setting in localStorage:', error);
    }
    const handednessSelect = document.getElementById('handedness-select');
    if (handednessSelect) handednessSelect.value = finalHandedness;

    // Ensure debug options/outlines are off on page load
    document.body.setAttribute('data-debug-bounds', 'false');
    await setConfig('debug-bounds', 'off');
    try {
        localStorage.setItem('debug-bounds', 'off');
    } catch (error) {
        console.warn('Failed to initialize debug-bounds setting in localStorage:', error);
    }
}
