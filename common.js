(function () {
    const tracks = window.randomWebsiteMusicDatabase || [];
    const audioStateKey = "randomWebsite.audioState";
    const themeKey = "randomWebsite.theme";
    const playerVisibilityKey = "randomWebsite.playerCollapsed";
    const fallbackState = {
        currentIndex: 0,
        currentTime: 0,
        loop: false,
        mode: "full",
        spatial: false,
        volume: 1,
        wasPlaying: false
    };

    const pageInitializers = {};
    const pageSubscribers = [];
    let globalAudio = null;
    let playerShell = null;
    let playerRestoreButton = null;
    let miniCover = null;
    let miniTitle = null;
    let miniArtist = null;
    let miniStatus = null;
    let miniPlay = null;
    let miniTimeline = null;
    let miniCurrentTime = null;
    let miniDuration = null;
    let miniVolume = null;
    let miniLoop = null;
    let miniSpatial = null;
    let miniVolumeText = null;
    let pendingResume = false;
    let playerCollapsed = localStorage.getItem(playerVisibilityKey) === "true";
    let savedBeforeTrailer = false;
    let audioContext = null;
    let audioSource = null;
    let spatialNode = null;
    let naturalOutput = null;
    let musicPageUnsubscribe = null;
    let currentState = readAudioState();

    function readAudioState() {
        try {
            return Object.assign({}, fallbackState, JSON.parse(localStorage.getItem(audioStateKey) || "{}"));
        } catch (error) {
            return Object.assign({}, fallbackState);
        }
    }

    function saveAudioState() {
        if (!globalAudio) {
            return;
        }

        currentState.currentTime = Number.isFinite(globalAudio.currentTime) ? globalAudio.currentTime : 0;
        currentState.volume = globalAudio.volume;
        currentState.loop = globalAudio.loop;
        currentState.wasPlaying = !globalAudio.paused && !globalAudio.ended;
        localStorage.setItem(audioStateKey, JSON.stringify(currentState));
    }

    function formatTime(value) {
        if (!Number.isFinite(value) || value < 0) {
            return "0:00";
        }

        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60).toString().padStart(2, "0");
        return minutes + ":" + seconds;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getTrack(index) {
        return tracks[clamp(index, 0, Math.max(tracks.length - 1, 0))];
    }

    function getTrackUrl(track) {
        return new URL(track.audio, window.location.href).href;
    }

    function ensureAudioSource() {
        const track = getTrack(currentState.currentIndex);

        if (!track || !globalAudio) {
            return;
        }

        const nextUrl = getTrackUrl(track);

        if (globalAudio.src !== nextUrl) {
            globalAudio.src = nextUrl;
            globalAudio.load();
        }
    }

    function setCurrentTimeSafely(value) {
        if (!globalAudio || !Number.isFinite(value)) {
            return;
        }

        const applyTime = function () {
            const duration = Number.isFinite(globalAudio.duration) && globalAudio.duration > 0
                ? globalAudio.duration
                : value;
            globalAudio.currentTime = clamp(value, 0, duration);
        };

        if (globalAudio.readyState >= 1) {
            applyTime();
            return;
        }

        globalAudio.addEventListener("loadedmetadata", applyTime, { once: true });
    }

    function emitPlayerUpdate() {
        updateMiniPlayer();
        pageSubscribers.slice().forEach(function (subscriber) {
            subscriber();
        });
    }

    function setStatus(message) {
        if (miniStatus) {
            miniStatus.textContent = message;
        }
    }

    function updateMiniPlayer() {
        if (!globalAudio || !tracks.length) {
            return;
        }

        const track = getTrack(currentState.currentIndex);
        const isPlaying = !globalAudio.paused && !globalAudio.ended;
        const duration = Number.isFinite(globalAudio.duration) ? globalAudio.duration : 0;
        const percent = duration > 0 ? (globalAudio.currentTime / duration) * 100 : 0;

        miniCover.src = track.cover;
        miniTitle.textContent = track.title;
        miniArtist.textContent = track.artist;
        miniPlay.textContent = isPlaying ? "Pausar" : "Play";
        miniPlay.setAttribute("aria-label", isPlaying ? "Pausar musica" : "Tocar musica");
        miniTimeline.value = String(percent);
        miniCurrentTime.textContent = formatTime(globalAudio.currentTime);
        miniDuration.textContent = formatTime(duration);
        miniVolume.value = String(Math.round(globalAudio.volume * 100));
        miniVolumeText.textContent = Math.round(globalAudio.volume * 100) + "%";
        miniLoop.setAttribute("aria-pressed", String(globalAudio.loop));
        miniLoop.textContent = globalAudio.loop ? "Loop ligado" : "Loop";
        miniSpatial.setAttribute("aria-pressed", String(currentState.spatial));
    }

    function subscribeToPlayer(callback) {
        pageSubscribers.push(callback);

        return function () {
            const index = pageSubscribers.indexOf(callback);

            if (index >= 0) {
                pageSubscribers.splice(index, 1);
            }
        };
    }

    function createGlobalAudio() {
        if (globalAudio) {
            return;
        }

        globalAudio = document.createElement("audio");
        globalAudio.id = "global-site-audio";
        globalAudio.preload = "metadata";
        globalAudio.volume = clamp(Number(currentState.volume), 0, 1);
        globalAudio.loop = Boolean(currentState.loop);
        document.body.appendChild(globalAudio);

        ensureAudioSource();
        setCurrentTimeSafely(Number(currentState.currentTime) || 0);

        globalAudio.addEventListener("loadedmetadata", emitPlayerUpdate);
        globalAudio.addEventListener("timeupdate", function () {
            saveAudioState();
            emitPlayerUpdate();
        });
        globalAudio.addEventListener("play", function () {
            pendingResume = false;
            saveAudioState();
            emitPlayerUpdate();
        });
        globalAudio.addEventListener("pause", function () {
            saveAudioState();
            emitPlayerUpdate();
        });
        globalAudio.addEventListener("ended", function () {
            currentState.wasPlaying = false;
            saveAudioState();
            setStatus("Musica finalizada.");
            emitPlayerUpdate();
        });
        globalAudio.addEventListener("error", function () {
            setStatus("Arquivo de audio local nao encontrado.");
        });
    }

    function createButton(action, text, label) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "site-player-button";
        button.dataset.playerAction = action;
        button.textContent = text;
        button.setAttribute("aria-label", label || text);
        return button;
    }

    function applyPlayerVisibility() {
        document.body.classList.toggle("player-collapsed", playerCollapsed);

        if (playerShell) {
            playerShell.setAttribute("aria-hidden", String(playerCollapsed));
        }

        if (playerRestoreButton) {
            playerRestoreButton.hidden = !playerCollapsed;
        }

        localStorage.setItem(playerVisibilityKey, String(playerCollapsed));
    }

    function placePlayerRestoreButton() {
        if (!playerRestoreButton) {
            return;
        }

        const footer = document.querySelector(".barra");

        if (footer) {
            document.body.insertBefore(playerRestoreButton, footer);
        } else {
            document.body.appendChild(playerRestoreButton);
        }
    }

    function createGlobalPlayerShell() {
        if (playerShell || !tracks.length) {
            return;
        }

        playerShell = document.createElement("section");
        playerShell.className = "site-player";
        playerShell.setAttribute("aria-label", "Player global de musicas");

        const now = document.createElement("div");
        now.className = "site-player-now";

        miniCover = document.createElement("img");
        miniCover.alt = "";
        miniCover.className = "site-player-cover";

        const nowText = document.createElement("div");
        const kicker = document.createElement("p");
        kicker.className = "site-player-kicker";
        kicker.textContent = "Tocando no site";
        miniTitle = document.createElement("strong");
        miniArtist = document.createElement("span");
        miniStatus = document.createElement("small");
        miniStatus.textContent = "Pronto para tocar.";
        nowText.append(kicker, miniTitle, miniArtist, miniStatus);
        now.append(miniCover, nowText);

        const controls = document.createElement("div");
        controls.className = "site-player-controls";
        const previous = createButton("previous", "Anterior", "Musica anterior");
        miniPlay = createButton("toggle", "Play", "Tocar musica");
        const next = createButton("next", "Proxima", "Proxima musica");
        miniLoop = createButton("loop", "Loop", "Alternar loop");
        miniSpatial = createButton("spatial", "Espacial", "Alternar som espacial");
        controls.append(previous, miniPlay, next, miniLoop, miniSpatial);

        const progress = document.createElement("div");
        progress.className = "site-player-progress";
        miniCurrentTime = document.createElement("span");
        miniCurrentTime.textContent = "0:00";
        miniTimeline = document.createElement("input");
        miniTimeline.type = "range";
        miniTimeline.min = "0";
        miniTimeline.max = "100";
        miniTimeline.value = "0";
        miniTimeline.setAttribute("aria-label", "Linha do tempo da musica");
        miniDuration = document.createElement("span");
        miniDuration.textContent = "0:00";
        progress.append(miniCurrentTime, miniTimeline, miniDuration);

        const volume = document.createElement("label");
        volume.className = "site-player-volume";
        const volumeLabel = document.createElement("span");
        volumeLabel.textContent = "Volume";
        miniVolume = document.createElement("input");
        miniVolume.type = "range";
        miniVolume.min = "0";
        miniVolume.max = "100";
        miniVolume.value = "100";
        miniVolume.setAttribute("aria-label", "Volume geral do site");
        miniVolumeText = document.createElement("strong");
        miniVolumeText.textContent = "100%";
        volume.append(volumeLabel, miniVolume, miniVolumeText);

        const closePlayer = document.createElement("button");
        closePlayer.type = "button";
        closePlayer.className = "site-player-close";
        closePlayer.dataset.playerAction = "collapse";
        closePlayer.textContent = "Fechar";
        closePlayer.setAttribute("aria-label", "Fechar player de musica");

        playerShell.append(now, controls, progress, volume, closePlayer);
        document.body.appendChild(playerShell);

        playerRestoreButton = document.createElement("button");
        playerRestoreButton.type = "button";
        playerRestoreButton.className = "site-player-restore";
        playerRestoreButton.textContent = "Abrir player";
        playerRestoreButton.setAttribute("aria-label", "Abrir player de musica");
        placePlayerRestoreButton();

        playerShell.addEventListener("click", function (event) {
            const button = event.target.closest("[data-player-action]");

            if (!button) {
                return;
            }

            const action = button.dataset.playerAction;

            if (action === "toggle") {
                togglePlay();
            } else if (action === "previous") {
                jumpTrack(-1);
            } else if (action === "next") {
                jumpTrack(1);
            } else if (action === "loop") {
                setLoop(!globalAudio.loop);
            } else if (action === "spatial") {
                setSpatial(!currentState.spatial);
            } else if (action === "collapse") {
                playerCollapsed = true;
                applyPlayerVisibility();
            }
        });

        playerRestoreButton.addEventListener("click", function () {
            playerCollapsed = false;
            applyPlayerVisibility();
        });

        miniTimeline.addEventListener("input", function () {
            if (!Number.isFinite(globalAudio.duration) || globalAudio.duration <= 0) {
                return;
            }

            globalAudio.currentTime = (Number(miniTimeline.value) / 100) * globalAudio.duration;
            emitPlayerUpdate();
        });

        miniVolume.addEventListener("input", function () {
            setVolume(Number(miniVolume.value) / 100);
        });

        updateMiniPlayer();
        applyPlayerVisibility();
    }

    function loadTrack(index, options) {
        const settings = Object.assign({
            play: false,
            reset: true,
            mode: "full",
            startAt: 0,
            status: "Faixa selecionada."
        }, options || {});

        if (!tracks.length) {
            return;
        }

        currentState.currentIndex = clamp(index, 0, tracks.length - 1);
        currentState.mode = settings.mode;
        ensureAudioSource();

        if (settings.reset) {
            setCurrentTimeSafely(settings.startAt);
        }

        setStatus(settings.status);
        saveAudioState();
        emitPlayerUpdate();

        if (settings.play) {
            playCurrent(settings.status || "Tocando.");
        }
    }

    function playCurrent(message) {
        if (!globalAudio || !tracks.length) {
            return;
        }

        ensureAudioSource();
        maybeEnableSpatial();

        if (globalAudio.ended) {
            globalAudio.currentTime = 0;
        }

        globalAudio.play()
            .then(function () {
                currentState.wasPlaying = true;
                setStatus(message || "Tocando.");
                saveAudioState();
                emitPlayerUpdate();
            })
            .catch(function () {
                pendingResume = true;
                currentState.wasPlaying = true;
                setStatus("Clique no site para continuar a musica.");
                saveAudioState();
                emitPlayerUpdate();
            });
    }

    function pauseCurrent(message) {
        if (!globalAudio) {
            return;
        }

        globalAudio.pause();
        currentState.wasPlaying = false;
        setStatus(message || "Pausado.");
        saveAudioState();
        emitPlayerUpdate();
    }

    function togglePlay() {
        if (!globalAudio || globalAudio.paused || globalAudio.ended) {
            playCurrent("Tocando a partir do ponto atual.");
            return;
        }

        pauseCurrent("Pausado.");
    }

    function jumpTrack(direction) {
        if (!tracks.length) {
            return;
        }

        const nextIndex = (currentState.currentIndex + direction + tracks.length) % tracks.length;
        loadTrack(nextIndex, {
            play: !globalAudio.paused,
            reset: true,
            status: direction > 0 ? "Proxima musica." : "Musica anterior."
        });
    }

    function setLoop(enabled) {
        currentState.loop = Boolean(enabled);
        globalAudio.loop = currentState.loop;
        setStatus(currentState.loop ? "Loop ligado." : "Loop desligado.");
        saveAudioState();
        emitPlayerUpdate();
    }

    function setVolume(value) {
        const volume = clamp(Number(value), 0, 1);
        currentState.volume = volume;
        globalAudio.volume = volume;
        saveAudioState();
        emitPlayerUpdate();
        window.dispatchEvent(new CustomEvent("randomWebsiteVolumeChange", { detail: { volume: volume } }));
    }

    function maybeEnableSpatial() {
        if (currentState.spatial) {
            setSpatial(true);
        }
    }

    function setSpatial(enabled) {
        currentState.spatial = Boolean(enabled);

        if (!currentState.spatial) {
            if (audioSource && naturalOutput) {
                try {
                    audioSource.disconnect();
                    audioSource.connect(naturalOutput);
                } catch (error) {
                    return;
                }
            }

            setStatus("Som espacial desligado.");
            saveAudioState();
            emitPlayerUpdate();
            return;
        }

        try {
            if (!audioContext) {
                const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContextConstructor();
                audioSource = audioContext.createMediaElementSource(globalAudio);
                spatialNode = audioContext.createPanner();
                spatialNode.panningModel = "HRTF";
                spatialNode.distanceModel = "inverse";
                spatialNode.positionX.value = 0;
                spatialNode.positionY.value = 0.15;
                spatialNode.positionZ.value = 0.85;
                naturalOutput = audioContext.destination;
            }

            audioSource.disconnect();
            audioSource.connect(spatialNode);
            spatialNode.connect(audioContext.destination);

            if (audioContext.state === "suspended") {
                audioContext.resume();
            }

            setStatus("Som espacial ligado.");
        } catch (error) {
            currentState.spatial = false;
            setStatus("Som espacial indisponivel neste navegador.");
        }

        saveAudioState();
        emitPlayerUpdate();
    }

    function restorePlaybackIfNeeded() {
        if (!tracks.length || !currentState.wasPlaying) {
            return;
        }

        playCurrent("Continuando a musica.");
    }

    function resumeAfterGesture() {
        if (pendingResume && currentState.wasPlaying) {
            playCurrent("Continuando a musica.");
        }
    }

    function updateActiveNavigation() {
        const currentPage = document.body.dataset.page;

        document.querySelectorAll(".menu a[data-nav]").forEach(function (link) {
            const isCurrent = link.dataset.nav === currentPage;
            link.classList.toggle("ativo", isCurrent);

            if (isCurrent) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    function applyTheme(theme) {
        const normalized = theme === "latte" ? "latte" : "frappe";
        document.documentElement.dataset.theme = normalized;
        localStorage.setItem(themeKey, normalized);
        updateThemeToggle();
    }

    function updateThemeToggle() {
        const toggle = document.querySelector(".theme-toggle");

        if (!toggle) {
            return;
        }

        const isLight = document.documentElement.dataset.theme === "latte";
        toggle.innerHTML = isLight
            ? '<span class="theme-toggle-orb" aria-hidden="true">☾</span><span>Tema escuro</span>'
            : '<span class="theme-toggle-orb" aria-hidden="true">☀</span><span>Tema claro</span>';
        toggle.setAttribute("aria-pressed", String(isLight));
        toggle.setAttribute("aria-label", isLight ? "Ativar tema escuro Catppuccin Frappe" : "Ativar tema claro Catppuccin Latte");
    }

    function ensureThemeToggle() {
        const menu = document.querySelector(".menu");

        if (!menu || menu.querySelector(".theme-toggle")) {
            updateThemeToggle();
            return;
        }

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "theme-toggle";
        toggle.addEventListener("click", function () {
            applyTheme(document.documentElement.dataset.theme === "latte" ? "frappe" : "latte");
        });
        menu.appendChild(toggle);
        updateThemeToggle();
    }

    function initCursorLight() {
        if (document.querySelector(".cyan-fireflies")) {
            return;
        }

        const field = document.createElement("div");
        field.className = "cyan-fireflies";
        field.setAttribute("aria-hidden", "true");

        for (let index = 0; index < 82; index += 1) {
            const firefly = document.createElement("span");
            firefly.className = "cyan-firefly";
            firefly.style.setProperty("--x", ((index * 17) % 100) + "%");
            firefly.style.setProperty("--y", ((index * 29) % 100) + "%");
            firefly.style.setProperty("--move-x", (((index % 9) - 4) * 22) + "px");
            firefly.style.setProperty("--alt-x", ((((index % 9) - 4) * -22)) + "px");
            firefly.style.setProperty("--move-y", (((index % 7) - 3) * 20) + "px");
            firefly.style.setProperty("--size", (2 + (index % 6)) + "px");
            firefly.style.setProperty("--duration", (7 + (index % 9)) + "s");
            firefly.style.setProperty("--delay", (-index * 0.32) + "s");
            field.appendChild(firefly);
        }

        document.body.appendChild(field);

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        let lastTrailAt = 0;

        document.addEventListener("pointermove", function (event) {
            const now = Date.now();

            if (now - lastTrailAt < 34) {
                return;
            }

            lastTrailAt = now;

            for (let index = 0; index < 2; index += 1) {
                const spark = document.createElement("span");
                spark.className = "cursor-firefly";
                spark.style.left = (event.clientX + ((index * 9) - 4)) + "px";
                spark.style.top = (event.clientY + ((index * -7) + 3)) + "px";
                spark.style.setProperty("--trail-x", ((((now + index) % 9) - 4) * 8) + "px");
                spark.style.setProperty("--trail-y", (-24 - ((now + index * 11) % 22)) + "px");
                field.appendChild(spark);

                spark.addEventListener("animationend", function () {
                    spark.remove();
                }, { once: true });

                window.setTimeout(function () {
                    spark.remove();
                }, 1350);
            }

            Array.from(field.querySelectorAll(".cursor-firefly")).slice(0, -42).forEach(function (spark) {
                spark.remove();
            });
        }, { passive: true });
    }

    function bindInfoModal() {
        if (pageInitializers.infoModal) {
            return;
        }

        pageInitializers.infoModal = true;

        document.addEventListener("click", function (event) {
            const trigger = event.target.closest("[data-modal-title]");
            const close = event.target.closest(".modal-close");
            const modal = document.getElementById("info-modal");

            if (trigger && modal) {
                const title = document.getElementById("modal-title");
                const body = document.getElementById("modal-body");

                title.textContent = trigger.dataset.modalTitle || "Informacao";
                body.textContent = trigger.dataset.modalBody || "";
                modal.hidden = false;
                modal.dataset.lastFocus = "true";
                modal.querySelector(".modal-close").focus();
                return;
            }

            if (close && modal) {
                modal.hidden = true;
                return;
            }

            if (modal && event.target === modal) {
                modal.hidden = true;
            }
        });

        document.addEventListener("keydown", function (event) {
            const modal = document.getElementById("info-modal");

            if (event.key === "Escape" && modal && !modal.hidden) {
                modal.hidden = true;
            }
        });
    }

    function bindContactForm() {
        if (pageInitializers.contact) {
            return;
        }

        pageInitializers.contact = true;

        document.addEventListener("submit", function (event) {
            const form = event.target.closest("#message-form");

            if (!form) {
                return;
            }

            event.preventDefault();

            const status = document.getElementById("form-status");
            const data = new FormData(form);
            const name = String(data.get("name")).trim();
            const message = String(data.get("message")).trim();

            if (!name || !message) {
                status.textContent = "Preencha todos os campos antes de enviar.";
                return;
            }

            const subject = "Mensagem pelo Random Website";
            const body = [
                "Nome: " + name,
                "",
                "Mensagem:",
                message
            ].join("\n");
            const mailto = "mailto:vitormgervazoni@gmail.com"
                + "?subject=" + encodeURIComponent(subject)
                + "&body=" + encodeURIComponent(body);

            status.textContent = "Abrindo seu email para finalizar o envio.";
            window.location.href = mailto;
        });
    }

    function bindMusicPage() {
        const audio = globalAudio;
        const cover = document.getElementById("player-cover");
        const title = document.getElementById("current-track-title");
        const artist = document.getElementById("current-track-artist");
        const mode = document.getElementById("player-mode");
        const status = document.getElementById("player-status");
        const playFull = document.getElementById("play-full");
        const playViral = document.getElementById("play-viral");
        const playPause = document.getElementById("play-pause");
        const resetButton = document.getElementById("reset-track");
        const loopButton = document.getElementById("loop-track");
        const timeline = document.getElementById("track-timeline");
        const currentTime = document.getElementById("current-time");
        const durationTime = document.getElementById("duration-time");
        const rows = Array.from(document.querySelectorAll(".song-row"));

        if (!audio || !cover || !rows.length || cover.dataset.bound === "true") {
            return;
        }

        if (musicPageUnsubscribe) {
            musicPageUnsubscribe();
        }

        cover.dataset.bound = "true";

        function updatePagePlayer() {
            if (!document.body.contains(cover)) {
                return;
            }

            const track = getTrack(currentState.currentIndex);
            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            const percent = duration > 0 ? (audio.currentTime / duration) * 100 : 0;

            cover.src = track.cover;
            title.textContent = track.title;
            artist.textContent = track.artist;
            mode.textContent = currentState.mode === "viral" ? "Trecho marcante" : "Musica inteira";
            playPause.textContent = audio.paused ? "Play" : "Pausar";
            loopButton.textContent = audio.loop ? "Loop: ligado" : "Loop: desligado";
            loopButton.setAttribute("aria-pressed", String(audio.loop));
            timeline.value = String(percent);
            currentTime.textContent = formatTime(audio.currentTime);
            durationTime.textContent = formatTime(duration);

            rows.forEach(function (row, index) {
                row.classList.toggle("active", index === currentState.currentIndex);
            });
        }

        rows.forEach(function (row) {
            row.addEventListener("click", function () {
                const index = Number(row.dataset.trackIndex);

                if (Number.isInteger(index) && tracks[index]) {
                    loadTrack(index, {
                        play: false,
                        reset: true,
                        status: "Faixa selecionada."
                    });
                    status.textContent = "Pronto para tocar.";
                }
            });
        });

        playFull.addEventListener("click", function () {
            loadTrack(currentState.currentIndex, {
                play: true,
                reset: true,
                mode: "full",
                startAt: 0,
                status: "Tocando a musica inteira."
            });
            status.textContent = "Tocando a musica inteira.";
        });

        playViral.addEventListener("click", function () {
            const track = getTrack(currentState.currentIndex);
            loadTrack(currentState.currentIndex, {
                play: false,
                reset: true,
                mode: "viral",
                startAt: Number(track.viralStart) || 0,
                status: "Trecho marcante preparado."
            });
            pauseCurrent("Trecho marcante preparado.");
            status.textContent = "Posicionado no trecho marcante. Aperte Play para ouvir.";
        });

        playPause.addEventListener("click", function () {
            togglePlay();
            status.textContent = audio.paused ? "Pausado." : "Tocando a partir do ponto atual.";
        });

        resetButton.addEventListener("click", function () {
            pauseCurrent("Resetado para o inicio.");
            setCurrentTimeSafely(0);
            currentState.mode = "full";
            status.textContent = "Resetado para o inicio.";
            emitPlayerUpdate();
        });

        loopButton.addEventListener("click", function () {
            setLoop(!audio.loop);
            status.textContent = audio.loop ? "Loop ativado." : "Loop desativado.";
        });

        timeline.addEventListener("input", function () {
            if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
                return;
            }

            audio.currentTime = (Number(timeline.value) / 100) * audio.duration;
            emitPlayerUpdate();
        });

        musicPageUnsubscribe = subscribeToPlayer(updatePagePlayer);
        updatePagePlayer();
    }

    function createTrailerPlayer() {
        if (document.querySelector(".trailer-overlay")) {
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "trailer-overlay";
        overlay.hidden = true;
        overlay.innerHTML = [
            '<section class="trailer-dialog" role="dialog" aria-modal="true" aria-labelledby="trailer-title">',
            '  <div class="trailer-topbar">',
            '    <div>',
            '      <p class="eyebrow">Trailer</p>',
            '      <h2 id="trailer-title">Trailer</h2>',
            '    </div>',
            '    <button class="trailer-icon-button" type="button" data-trailer-close aria-label="Fechar trailer">x</button>',
            '  </div>',
            '  <div class="trailer-stage">',
            '    <video class="trailer-video is-enhanced" playsinline preload="metadata"></video>',
            '    <button class="trailer-play-surface" type="button" aria-label="Tocar ou pausar trailer">Play</button>',
            '  </div>',
            '  <div class="trailer-controls" aria-label="Controles do trailer">',
            '    <button type="button" data-video-action="play">Play</button>',
            '    <button type="button" data-video-action="rewind">-10s</button>',
            '    <button type="button" data-video-action="forward">+10s</button>',
            '    <span class="trailer-time" data-video-current>0:00</span>',
            '    <input class="trailer-timeline" type="range" min="0" max="100" value="0" aria-label="Linha do tempo do trailer">',
            '    <span class="trailer-time" data-video-duration>0:00</span>',
            '    <button type="button" data-video-action="mute">Som</button>',
            '    <label class="trailer-volume">Volume <input type="range" min="0" max="100" value="100" aria-label="Volume do trailer"></label>',
            '    <select class="trailer-speed" aria-label="Velocidade do trailer">',
            '      <option value="0.75">0.75x</option>',
            '      <option value="1" selected>1x</option>',
            '      <option value="1.25">1.25x</option>',
            '      <option value="1.5">1.5x</option>',
            '    </select>',
            '    <button type="button" data-video-action="enhance" aria-pressed="true">Nitidez</button>',
            '    <button type="button" data-video-action="spatial" aria-pressed="false">Espacial</button>',
            '    <button type="button" data-video-action="pip">PiP</button>',
            '    <button type="button" data-video-action="fullscreen">Tela cheia</button>',
            '    <span class="trailer-quality" data-video-quality>Auto</span>',
            '  </div>',
            '</section>'
        ].join("");

        document.body.appendChild(overlay);

        const video = overlay.querySelector("video");
        const title = overlay.querySelector("#trailer-title");
        const playSurface = overlay.querySelector(".trailer-play-surface");
        const playButton = overlay.querySelector('[data-video-action="play"]');
        const muteButton = overlay.querySelector('[data-video-action="mute"]');
        const timeline = overlay.querySelector(".trailer-timeline");
        const volume = overlay.querySelector(".trailer-volume input");
        const speed = overlay.querySelector(".trailer-speed");
        const current = overlay.querySelector("[data-video-current]");
        const duration = overlay.querySelector("[data-video-duration]");
        const quality = overlay.querySelector("[data-video-quality]");
        const enhanceButton = overlay.querySelector('[data-video-action="enhance"]');
        const spatialButton = overlay.querySelector('[data-video-action="spatial"]');
        let trailerAudioContext = null;
        let trailerSource = null;
        let trailerPanner = null;
        let trailerSpatial = false;

        function updateVideoControls() {
            const videoDuration = Number.isFinite(video.duration) ? video.duration : 0;
            const percent = videoDuration > 0 ? (video.currentTime / videoDuration) * 100 : 0;

            playButton.textContent = video.paused ? "Play" : "Pausar";
            playSurface.textContent = video.paused ? "Play" : "Pausar";
            playSurface.classList.toggle("is-hidden", !video.paused);
            muteButton.textContent = video.muted || video.volume === 0 ? "Mudo" : "Som";
            timeline.value = String(percent);
            current.textContent = formatTime(video.currentTime);
            duration.textContent = formatTime(videoDuration);
            volume.value = String(Math.round(video.volume * 100));

            if (video.videoHeight) {
                quality.textContent = "Auto " + video.videoHeight + "p";
            }
        }

        function closeTrailer() {
            overlay.hidden = true;
            video.pause();
            video.removeAttribute("src");
            video.load();

            if (savedBeforeTrailer) {
                playCurrent("Continuando a musica.");
            }
        }

        function openTrailer(trigger) {
            savedBeforeTrailer = globalAudio && !globalAudio.paused && !globalAudio.ended;

            if (savedBeforeTrailer) {
                pauseCurrent("Musica pausada durante o trailer.");
            }

            title.textContent = trigger.dataset.trailerTitle || "Trailer";
            video.src = trigger.dataset.trailerSrc;
            video.poster = trigger.dataset.trailerPoster || "";
            video.volume = globalAudio ? globalAudio.volume : 1;
            volume.value = String(Math.round(video.volume * 100));
            video.playbackRate = 1;
            speed.value = "1";
            trailerSpatial = false;
            spatialButton.setAttribute("aria-pressed", "false");
            overlay.hidden = false;
            updateVideoControls();
            playSurface.focus();
            video.play()
                .then(updateVideoControls)
                .catch(function () {
                    playSurface.textContent = "Play";
                    updateVideoControls();
                });
        }

        function setTrailerSpatial(enabled) {
            trailerSpatial = Boolean(enabled);
            spatialButton.setAttribute("aria-pressed", String(trailerSpatial));

            if (!trailerSpatial) {
                if (trailerSource) {
                    try {
                        trailerSource.disconnect();
                        trailerSource.connect(trailerAudioContext.destination);
                    } catch (error) {
                        return;
                    }
                }
                return;
            }

            try {
                if (!trailerAudioContext) {
                    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
                    trailerAudioContext = new AudioContextConstructor();
                    trailerSource = trailerAudioContext.createMediaElementSource(video);
                    trailerPanner = trailerAudioContext.createPanner();
                    trailerPanner.panningModel = "HRTF";
                    trailerPanner.distanceModel = "inverse";
                    trailerPanner.positionX.value = 0;
                    trailerPanner.positionY.value = 0.12;
                    trailerPanner.positionZ.value = 0.9;
                }

                trailerSource.disconnect();
                trailerSource.connect(trailerPanner);
                trailerPanner.connect(trailerAudioContext.destination);

                if (trailerAudioContext.state === "suspended") {
                    trailerAudioContext.resume();
                }
            } catch (error) {
                trailerSpatial = false;
                spatialButton.setAttribute("aria-pressed", "false");
            }
        }

        document.addEventListener("click", function (event) {
            const trigger = event.target.closest("[data-trailer-open]");

            if (trigger) {
                openTrailer(trigger);
            }
        });

        overlay.addEventListener("click", function (event) {
            const close = event.target.closest("[data-trailer-close]");
            const actionButton = event.target.closest("[data-video-action]");

            if (event.target === overlay || close) {
                closeTrailer();
                return;
            }

            if (!actionButton) {
                return;
            }

            const action = actionButton.dataset.videoAction;

            if (action === "play") {
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            } else if (action === "rewind") {
                video.currentTime = Math.max(video.currentTime - 10, 0);
            } else if (action === "forward") {
                video.currentTime = Math.min(video.currentTime + 10, video.duration || video.currentTime + 10);
            } else if (action === "mute") {
                video.muted = !video.muted;
            } else if (action === "enhance") {
                video.classList.toggle("is-enhanced");
                enhanceButton.setAttribute("aria-pressed", String(video.classList.contains("is-enhanced")));
            } else if (action === "spatial") {
                setTrailerSpatial(!trailerSpatial);
            } else if (action === "pip" && document.pictureInPictureEnabled) {
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture();
                } else {
                    video.requestPictureInPicture();
                }
            } else if (action === "fullscreen") {
                const dialog = overlay.querySelector(".trailer-dialog");

                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else if (dialog.requestFullscreen) {
                    dialog.requestFullscreen();
                }
            }

            updateVideoControls();
        });

        playSurface.addEventListener("click", function () {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });

        timeline.addEventListener("input", function () {
            if (!Number.isFinite(video.duration) || video.duration <= 0) {
                return;
            }

            video.currentTime = (Number(timeline.value) / 100) * video.duration;
            updateVideoControls();
        });

        volume.addEventListener("input", function () {
            video.volume = Number(volume.value) / 100;
            video.muted = video.volume === 0;
            setVolume(video.volume);
            updateVideoControls();
        });

        speed.addEventListener("change", function () {
            video.playbackRate = Number(speed.value);
        });

        video.addEventListener("loadedmetadata", updateVideoControls);
        video.addEventListener("timeupdate", updateVideoControls);
        video.addEventListener("play", updateVideoControls);
        video.addEventListener("pause", updateVideoControls);
        video.addEventListener("volumechange", updateVideoControls);
        video.addEventListener("ended", updateVideoControls);

        window.addEventListener("randomWebsiteVolumeChange", function (event) {
            if (!overlay.hidden) {
                video.volume = event.detail.volume;
                updateVideoControls();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (overlay.hidden) {
                return;
            }

            if (event.key === "Escape") {
                closeTrailer();
            } else if (event.key === " " && document.activeElement !== timeline) {
                event.preventDefault();

                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            }
        });
    }

    function bindInternalNavigation() {
        document.addEventListener("click", function (event) {
            const link = event.target.closest("a[href]");

            if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            if (link.target || link.hasAttribute("download") || link.dataset.noSpa === "true") {
                return;
            }

            const url = new URL(link.href, window.location.href);

            if (url.origin !== window.location.origin || !url.pathname.endsWith(".html")) {
                return;
            }

            event.preventDefault();
            navigateTo(url.href, true);
        });

        window.addEventListener("popstate", function () {
            navigateTo(window.location.href, false);
        });
    }

    function replaceElement(selector, nextDocument) {
        const current = document.querySelector(selector);
        const next = nextDocument.querySelector(selector);

        if (current && next) {
            current.replaceWith(next);
        }
    }

    function updatePageFromDocument(nextDocument) {
        document.title = nextDocument.title;
        document.body.dataset.page = nextDocument.body.dataset.page || "";

        replaceElement(".cabeca", nextDocument);
        replaceElement(".menu", nextDocument);
        replaceElement("main", nextDocument);
        replaceElement(".barra", nextDocument);

        document.querySelectorAll(".modal-backdrop").forEach(function (modal) {
            modal.remove();
        });

        const nextModal = nextDocument.querySelector(".modal-backdrop");

        if (nextModal) {
            document.body.appendChild(nextModal);
        }

        refreshPage();
    }

    function navigateTo(url, pushHistory) {
        fetch(url)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Pagina nao encontrada.");
                }

                return response.text();
            })
            .then(function (html) {
                const parser = new DOMParser();
                const nextDocument = parser.parseFromString(html, "text/html");

                updatePageFromDocument(nextDocument);

                if (pushHistory) {
                    history.pushState({}, "", url);
                }

                window.scrollTo({ top: 0, behavior: "smooth" });
            })
            .catch(function () {
                window.location.href = url;
            });
    }

    function refreshPage() {
        updateActiveNavigation();
        ensureThemeToggle();
        bindInfoModal();
        bindContactForm();
        bindMusicPage();
        placePlayerRestoreButton();
    }

    window.randomWebsiteAudio = {
        bindMusicPage: bindMusicPage,
        loadTrack: loadTrack,
        play: playCurrent,
        pause: pauseCurrent,
        setVolume: setVolume,
        getState: function () {
            return Object.assign({}, currentState);
        }
    };

    applyTheme(localStorage.getItem(themeKey) || "frappe");
    createGlobalAudio();
    createGlobalPlayerShell();
    createTrailerPlayer();
    bindInternalNavigation();
    initCursorLight();
    refreshPage();
    restorePlaybackIfNeeded();

    document.addEventListener("pointerdown", resumeAfterGesture);
    document.addEventListener("keydown", resumeAfterGesture);
}());
