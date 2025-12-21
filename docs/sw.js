const staticCache = "JazzHu|UprootedHomekinbyJasminHu-cache-v1";
var prefetchList = ["spa","index"];
var imageNames = [""];

var supportsWebP = determineIfSupportWebp();
var supportsGoogleHostedAMP = determineIfSupportsGoogleHostedAMP();
var largestBreakPoint = 0;
var mSizes = null;
var mHasPrefetched = false;

self.addEventListener("install", function (extendableEvent) {
    console.log("SW: Installed and updated");
    caches
        .open(staticCache)
        .then(function (cache) {
            return Promise.all(
                prefetchList.map(async function (url) {
                    try {
                        let networkResponse = await fetch(url);
                        if (200 == networkResponse.status) {
                            return cache.put(url, networkResponse);
                        }
                    } catch (error) {
                        return new Response(`Installing ${url} has error: ${error}`, { status: 500 });
                    }
                })
            );
        })
        .catch(function (b) {
            console.error(b);
        })
    self.skipWaiting();
});
self.addEventListener("activate", function (extendableEvent) {
    console.log("SW: Activate");
    self.clients.claim();
    caches
        .keys()
        .then(function (b) {
            return Promise.all(
                b.map(function (a) {
                    if (a != staticCache) {
                        return caches.delete(a);
                    }
                })
            );
        }).catch(function (b) {
            console.error(b);
        })
});
self.addEventListener("fetch", function (fetchEvent) {
    if (fetchEvent.request === undefined || fetchEvent.respondWith == undefined || !supportsGoogleHostedAMP) {
        return;
    }

    let url = fetchEvent.request.url;
    if ("http" !== url.slice(0, 4)) {
        return;
    }

    fetchEvent.respondWith(
        caches.open(staticCache).then(async function (cache) {
            if (mSizes == null) {
                await cache.match('sizes').then(async function (cachedResponse) {
                    mSizes = cachedResponse ? JSON.parse(await cachedResponse.text()) : {};
                });
            }

            let key, size;
            [key, url, size] = determineFileToDownload(url, fetchEvent.request.mode === 'navigate');

            if (key in mSizes && mSizes[key] < size) {
                return getFile(key, url, cache, size);
            }
            return cache.match(key).then(function (cachedResponse) {
                let fetchPromise = getFile(key, url, cache, size);
                return cachedResponse || fetchPromise;
            });
        })
    );
});
async function getFile(key, url, cache, size) {
    try {
        let networkResponse = await fetch(url);
        if (200 != networkResponse.status) {
            if (404 == networkResponse.status && isMyHtmlPage(url)) {
                return modifyResponse(networkResponse, { 'Did you mistype it?': `Did you mistype "${basename(url)}"?` });
            }
            return networkResponse;
        }

        if (key.endsWith("jpg")) {
            if (!(key in mSizes) || mSizes[key] <= size) {
                cache.put(key, networkResponse.clone());
                if (mSizes[key] != size) {
                    mSizes[key] = parseInt(size);
                    cache.put('sizes', new Response(JSON.stringify(mSizes)));
                }
            }
        } else {
            if (isSameOrigin(url)) {
                key = new URL(networkResponse.url).pathname;
            }
            cache.put(key, networkResponse.clone());
        }
        prefetchRestOfSite(key, cache, size, origin);
        return networkResponse;
    } catch (error) {
        return new Response(`Fetching ${url} has error: ${error}`, { status: 500});
    }
}
function basename(url) {
    return url.split("/").pop();
}
function isMyHtmlPage(url) {
    return isSameOrigin(url) && basename(url).indexOf('.') === -1;
}
function isSameOrigin(url) {
    return url.startsWith('/') || url.startsWith(this.location.origin);
}
function prefetchRestOfSite(key, cache, size) {
    if (mSizes == null || mHasPrefetched || !key.endsWith("jpg")) {
        return;
    }
    mHasPrefetched = true;

    let suffix = size == 2000 ? '' : `.${size}`;
    imageNames.map(image => {
        if (image != "spa" && (!(image in mSizes) || mSizes[image] < size)) {
            let key = `images/${image}.jpg`;

            cache.match(key).then(function (cachedResponse) {
                if (cachedResponse === undefined) {
                    getFile(key, imagePath(`images/${image}${suffix}.jpg`), cache, size);
                }
            });
        }
    });
    imageNames.map(image => {
        if (!(image in mSizes)) {
            let key = '/' + (image == 'index' ? '' : image);

            cache.match(key).then(function (cachedResponse) {
                if (cachedResponse === undefined) {
                    getFile(key, key, cache, size);
                }
            });
        }
    });
}

function determineIfSupportsGoogleHostedAMP() {
    if (navigator.userAgentData === undefined || navigator.userAgentData.brands === undefined) {
        return true;
    }
    let brands = navigator.userAgentData.brands;
    for (let i = 0; i < brands.length; i++) {
        if (brands[i].brand === "Brave") {
            return false;
        }
    }
    return true;
}
function determineIfSupportWebp() {
    // Safari 14 and later supports Webp; 
    let match = navigator.userAgent.match(/Mac OS.*Version\/(\d+)/i);
    return (match == null) || parseInt(match[1]) >= 14;
}
function imagePath(filename) {
    return supportsWebP ? filename.slice(0, -3) + 'webp' : filename;
}
function determineFileToDownload(url, isNavigate) {
    if (!url.endsWith(".jpg") && !url.endsWith(".webp")) {
        let key = url;
        if (this.isMyHtmlPage(url) && isNavigate && supportsGoogleHostedAMP) {
            url = "/spa";
            key = url;
        } else if (isSameOrigin(url)) {
            key = new URL(url).pathname;
        }
        return [key, url, 2000];
    }

    let fileName = url.split('/').pop().replace('.webp', '.jpg');

    let key, size;
    [key, size] = determineFileToDownloadImpl(fileName, "506.jpg");
    if (key == '') {
        [key, size] = determineFileToDownloadImpl(fileName, "1440.jpg");
        if (key == '') {
            [key, size] = determineFileToDownloadImpl(fileName, "1080.jpg");
            if (key == '') {
                [key, size] = determineFileToDownloadImpl(fileName, "640.jpg");
                if (key == '') {
                    key = 'images/' + fileName;
                    return [key, imagePath(key), 2000];
                }
            }
        }
    }

    key = 'images/' + key;
    if (key in mSizes && mSizes[key] > size) {
        size = mSizes[key];
    }
    let suffix = size == 2000 ? "" : "." + size;
    return [key, imagePath(key.slice(0, -4) + suffix + ".jpg"), size];
}
function determineFileToDownloadImpl(filename, suffix) {
    let size = 2000;
    let retValue = '';
    if (filename.endsWith(suffix)) {
        retValue = filename.slice(0, -suffix.length) + "jpg";
        size = suffix.slice(0, -4);
    }
    return [retValue, size];
}
function modifyResponse(networkResponse, values) {
    const reader = networkResponse.body.getReader();
    const stream = new ReadableStream({
        start(controller) {
            let data = [];
            function push() {
                return reader.read().then(({ done, value }) => {
                    if (value !== undefined) {
                        if (data.length === 0) {
                            data = value;
                        } else {
                            const len = value.length;
                            for(let i = 0; i < len; i++) {
                                data.push(value[i]);
                            }
                        }
                    }
                    if (done) {
                        let str = new TextDecoder("utf-8").decode(Uint8Array.from(data));
                        let searchKeys = Object.keys(values).map(key => key.replace('?', '\\?')).join('|');
                        let regex = new RegExp("(" + searchKeys + ")", "g");

                        str = str.replace(regex, (match) => {
                            return values[match];
                        });

                        controller.enqueue(new TextEncoder("utf-8").encode(str));
                        controller.close();
                        return;
                    }
                    push();
                });
            };
            push();
        }
    });
    return new Response(stream, { status: networkResponse.status, statusText: networkResponse.statusText, headers: networkResponse.headers });
}