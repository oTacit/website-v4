(function () {
    const tracks = window.randomWebsiteMusicDatabase || [];

    const audio = document.getElementById("site-audio");
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

    let currentIndex = 0;
    let loopEnabled = false;

    function formatTime(value) {
        if (!Number.isFinite(value) || value < 0) {
            return "0:00";
        }

        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60).toString().padStart(2, "0");
        return minutes + ":" + seconds;
    }

    function getCurrentTrack() {
        return tracks[currentIndex];
    }

    function setPlayButton(isPlaying) {
        playPause.textContent = isPlaying ? "Pausar" : "Play";
    }

    function updateRows() {
        rows.forEach(function (row, index) {
            row.classList.toggle("active", index === currentIndex);
        });
    }

    function updateLoopButton() {
        audio.loop = loopEnabled;
        loopButton.setAttribute("aria-pressed", String(loopEnabled));
        loopButton.textContent = loopEnabled ? "Loop: ligado" : "Loop: desligado";
    }

    function updateTimeline() {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            timeline.value = String((audio.currentTime / audio.duration) * 100);
            durationTime.textContent = formatTime(audio.duration);
        } else {
            timeline.value = "0";
            durationTime.textContent = "0:00";
        }

        currentTime.textContent = formatTime(audio.currentTime);
    }

    function resetTimelineFields() {
        audio.currentTime = 0;
        updateTimeline();
    }

    function resetTimelineDisplay() {
        timeline.value = "0";
        currentTime.textContent = "0:00";
        durationTime.textContent = Number.isFinite(audio.duration)
            ? formatTime(audio.duration)
            : "0:00";
    }

    function loadTrack(index) {
        currentIndex = index;

        const track = getCurrentTrack();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        cover.src = track.cover;
        title.textContent = track.title;
        artist.textContent = track.artist;
        mode.textContent = "Música inteira";
        status.textContent = "Pronto para tocar.";
        setPlayButton(false);
        resetTimelineDisplay();
        updateRows();
    }

    function ensureSource(track) {
        const currentSource = audio.getAttribute("src") || "";

        if (!currentSource.includes(track.audio)) {
            audio.src = track.audio;
            audio.load();
        }
    }

    function clampTime(value) {
        if (!Number.isFinite(value) || value < 0) {
            return 0;
        }

        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            return Math.min(value, audio.duration);
        }

        return value;
    }

    function waitForMetadata(callback) {
        if (audio.readyState >= 1) {
            callback();
            return;
        }

        status.textContent = "Carregando áudio local.";
        audio.addEventListener("loadedmetadata", callback, { once: true });
    }

    function playFromCurrent(successMessage) {
        const track = getCurrentTrack();
        ensureSource(track);

        if (audio.ended) {
            audio.currentTime = 0;
        }

        audio.play()
            .then(function () {
                status.textContent = successMessage;
                setPlayButton(true);
            })
            .catch(function () {
                status.textContent = "Arquivo de áudio local não encontrado para esta música.";
                setPlayButton(false);
            });
    }

    rows.forEach(function (row) {
        row.addEventListener("click", function () {
            const index = Number(row.dataset.trackIndex);
            if (Number.isInteger(index) && tracks[index]) {
                loadTrack(index);
            }
        });
    });

    playFull.addEventListener("click", function () {
        const track = getCurrentTrack();
        mode.textContent = "Música inteira";
        ensureSource(track);

        waitForMetadata(function () {
            audio.currentTime = 0;
            updateTimeline();
            playFromCurrent("Tocando a música inteira.");
        });
    });

    playViral.addEventListener("click", function () {
        const track = getCurrentTrack();
        mode.textContent = "Trecho marcante";
        ensureSource(track);

        waitForMetadata(function () {
            audio.pause();
            audio.currentTime = clampTime(track.viralStart);
            updateTimeline();
            status.textContent = "Posicionado no trecho marcante. Aperte Play para ouvir.";
            setPlayButton(false);
        });
    });

    playPause.addEventListener("click", function () {
        if (audio.paused) {
            playFromCurrent("Tocando a partir do ponto atual.");
            return;
        }

        audio.pause();
        status.textContent = "Pausado.";
        setPlayButton(false);
    });

    resetButton.addEventListener("click", function () {
        audio.pause();
        mode.textContent = "Música inteira";

        if (audio.getAttribute("src")) {
            resetTimelineFields();
        } else {
            resetTimelineDisplay();
        }

        status.textContent = "Resetado para o início.";
        setPlayButton(false);
    });

    loopButton.addEventListener("click", function () {
        loopEnabled = !loopEnabled;
        updateLoopButton();
        status.textContent = loopEnabled ? "Loop ativado." : "Loop desativado.";
    });

    timeline.addEventListener("input", function () {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
            return;
        }

        audio.currentTime = (Number(timeline.value) / 100) * audio.duration;
    });

    audio.addEventListener("loadedmetadata", function () {
        updateTimeline();
    });

    audio.addEventListener("timeupdate", function () {
        updateTimeline();
    });

    audio.addEventListener("ended", function () {
        status.textContent = "Música finalizada.";
        setPlayButton(false);
    });

    audio.addEventListener("error", function () {
        status.textContent = "Arquivo de áudio local não encontrado para esta música.";
        setPlayButton(false);
    });

    if (tracks.length) {
        loadTrack(0);
        updateLoopButton();
    } else {
        status.textContent = "Banco local de músicas não encontrado.";
    }
}());
