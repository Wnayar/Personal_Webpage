function redirectinsight(){
    location.href = "/insights";
}


function redirectphilosophy(){
     location.href = "/philosophy";
 }

function initProfilePhoto() {
    const wrap = document.querySelector(".profile-photo-wrap");
    const img = document.getElementById("profile");
    if (!wrap || !img) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        wrap.classList.add("is-loaded");
        return;
    }
    function markReady() {
        wrap.classList.add("is-loaded");
    }
    if (img.complete && img.naturalWidth > 0) {
        markReady();
        return;
    }
    img.addEventListener("load", markReady, { once: true });
    img.addEventListener("error", markReady, { once: true });
}

function initAquaShowcaseImages() {
    var reduced =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.querySelectorAll("img.av-showcase__img").forEach(function (img) {
        var screen = img.closest(".av-showcase__screen");

        function markLoaded() {
            if (screen) screen.classList.add("is-loaded");
        }

        function fail() {
            if (screen) {
                screen.classList.add("av-showcase__screen--fallback");
                if (!screen.querySelector(".av-showcase__fallback-hint")) {
                    var hint = document.createElement("span");
                    hint.className = "av-showcase__fallback-hint";
                    var name =
                        img.getAttribute("data-fallback-name") || "image";
                    hint.textContent =
                        "Add " +
                        name +
                        " to static/aqua-vitae/ (see README in that folder)";
                    screen.appendChild(hint);
                }
            }
            img.remove();
        }

        if (reduced) {
            markLoaded();
        }

        if (img.complete && img.naturalWidth === 0) {
            fail();
            return;
        }

        img.addEventListener(
            "error",
            function () {
                fail();
            },
            { once: true }
        );

        if (img.complete && img.naturalWidth > 0) {
            markLoaded();
            return;
        }

        img.addEventListener("load", markLoaded, { once: true });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
        initProfilePhoto();
        initAquaShowcaseImages();
    });
} else {
    initProfilePhoto();
    initAquaShowcaseImages();
}