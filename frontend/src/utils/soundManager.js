class SoundManager {
    constructor() {
        this.sounds = {
            click: new Audio('/sounds/click.mp3'),
            typing: new Audio('/sounds/typing.mp3'),
            notification: new Audio('/sounds/notification.mp3'),
            success: new Audio('/sounds/success.mp3'),
            alert: new Audio('/sounds/alert.mp3')
        };

        // Enable infinite looping for order/alert notifications until user interacts
        if (this.sounds.notification) this.sounds.notification.loop = true;
        if (this.sounds.alert) this.sounds.alert.loop = true;

        this.enabled = localStorage.getItem('soundEnabled') !== 'false'; // Default to true if not set
        this.volume = 0.3;
        this.pendingPlayTypes = new Set();
        this.unlockBound = false;

        // Preload sounds and set volume
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
            // Preload but catch errors silently to prevent issues if files are missing
            sound.load();
            sound.onerror = () => { /* Silent failure */ };
        });

        this.bindUnlockHandlers();
    }

    bindUnlockHandlers() {
        if (this.unlockBound || typeof window === 'undefined') return;

        this.unlockBound = true;
        
        const unlockAndReplay = () => {
            if (!this.pendingPlayTypes.size) return;
            const queued = Array.from(this.pendingPlayTypes);
            this.pendingPlayTypes.clear();
            queued.forEach((type) => this.play(type, { force: true }));
        };

        const interactionStopper = () => {
            this.stopLoopingSounds();
        };

        // Unlock audio context on any generic interaction
        ['pointerdown', 'keydown', 'touchstart', 'click'].forEach((eventName) => {
            window.addEventListener(eventName, unlockAndReplay, { passive: true });
        });

        // Stop looping alarms ONLY on explicit pointer clicks/touches (not typing, so working doesn't mute alarms accidentally)
        ['pointerdown', 'touchstart'].forEach((eventName) => {
            window.addEventListener(eventName, interactionStopper, { passive: true });
        });
    }

    stopLoopingSounds() {
        // Stop the looping sounds once user interacts with the app
        ['notification', 'alert'].forEach(type => {
            const sound = this.sounds[type];
            if (sound && !sound.paused) {
                sound.pause();
                sound.currentTime = 0;
            }
        });
    }

    play(type, options = {}) {
        const { force = false } = options;
        if ((!this.enabled && !force) || !this.sounds[type]) return;

        const sound = this.sounds[type];

        // If the alarm is already ringing, DO NOT interrupt it! 
        // Interrupting a playing audio with currentTime=0 causes it to reject the play promise in some browsers.
        if (!sound.paused) {
            sound.muted = false;
            sound.volume = this.volume;
            return;
        }

        sound.muted = false;
        sound.volume = this.volume;
        sound.currentTime = 0; // Reset to start

        const playPromise = sound.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                this.pendingPlayTypes.add(type);

                // Fallback: try a fresh Audio instance for edge decode/caching failures.
                try {
                    const fallbackSound = new Audio(sound.src);
                    fallbackSound.volume = this.volume;
                    fallbackSound.loop = sound.loop; // Inherit loop property
                    fallbackSound.currentTime = 0;
                    fallbackSound.play().then(() => {
                        this.sounds[type] = fallbackSound; // Save fallback so it can be stopped via interactions
                    }).catch(() => {
                        this.pendingPlayTypes.add(type);
                    });
                } catch (_) {
                    this.pendingPlayTypes.add(type);
                }
            });
        }
    }

    warmup(type = 'notification') {
        const originalSound = this.sounds[type];
        if (!originalSound) return;

        // Use a disposable audio instance for warming up so it doesn't corrupt the main instance!
        // This unlocks the audio cache for this src without interfering with real notifications.
        try {
            const warmupSound = new Audio(originalSound.src);
            warmupSound.volume = 0;
            warmupSound.muted = true;
            warmupSound.play()
                .then(() => {
                    warmupSound.pause();
                    warmupSound.src = ''; // cleanup
                })
                .catch(() => {
                    // Ignore warmup playback restrictions.
                });
        } catch (_) {}
    }

    toggle(state) {
        this.enabled = state;
        localStorage.setItem('soundEnabled', state);
    }

    isEnabled() {
        return this.enabled;
    }

    // Safety check method
    checkSound(type) {
        return this.sounds[type] ? true : false;
    }
}

const soundManager = new SoundManager();
export default soundManager;
