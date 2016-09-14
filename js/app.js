/**
 * Created by Eivind Røe <eivindroe@gmail.com> on 06.08.2016.
 */
(function($) {
    'use strict';
    var view, camera, map, wall, sites;

    function getTime() {
        if(typeof Date.now !== typeof undefined) {
            return Date.now();
        } else {
            // Fallback for IE8
            return new Date().getTime();
        }
    }

    function Sites() {
        var fncCallbackOnFetchedSites,
            strSiteApiUrl = "http://api.mytent.site/tentsites";

        function hasExtendedCacheLifeTime() {
            var intLastFetchTime = localStorage.getItem("Sites.lastFetchTime");
            if(!intLastFetchTime) {
                return true;
            } else {
                // Cache lifetime is one hour
                return ((getTime() - intLastFetchTime) > 3600000);
            }
        }

        function fetchSites() {
            if(hasExtendedCacheLifeTime()) {
                localStorage.removeItem("Sites.all");
            }

            var storedImages = localStorage.getItem("Sites.all");

            if(storedImages) {
                fncCallbackOnFetchedSites(JSON.parse(localStorage.getItem("Sites.all")));
            } else {
                $.ajax({
                    url: strSiteApiUrl,
                    success: function(response) {
                        var tentSites = [];
                        if(parseInt(response.code) === 200 && typeof response.data !== typeof undefined) {
                            $.each(response.data, function(key, photo) {
                                tentSites.push({
                                    id: photo["id"],
                                    reported_by: photo["reported_by"],
                                    lat: photo["latitude"],
                                    lng: photo["longitude"],
                                    location_name: photo["location_name"],
                                    created_time: photo["created_time"],
                                    likes: photo["likes"],
                                    img_location: photo["img_location"],
                                    external_id: photo["external_id"],
                                    thumbnail: photo["thumbnail_location"],
                                    caption: photo["caption"],
                                    created_at: photo["created_at"],
                                    updated_at: photo["updated_at"]
                                });
                            });
                        }

                        if(!storedImages) {
                            storedImages = [];
                        } else {
                            storedImages = JSON.parse(storedImages);
                        }

                        storedImages = storedImages.concat(tentSites);

                        localStorage.setItem("Sites.lastFetchTime", getTime());
                        localStorage.setItem("Sites.all", JSON.stringify(storedImages));
                        fncCallbackOnFetchedSites(tentSites);
                    }, error: function(error) {
                        console.log(error);
                    }
                });
            }
        }

        return {
            "onFetchedSites" : function(fncCallback) {
                fncCallbackOnFetchedSites = fncCallback;
                fetchSites();
            }
        }
    }

    function Map() {
        var loaded = false,
            TentMap,
            locationCircle,
            $map;

        // Configure layers
        var WorldImagery = L.tileLayer(
            'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, '+
                'GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }),
            OpenStreetMap = L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                subdomains: ["a","b","c"]
            });

        // Configure base maps
        var baseMaps = {
            "World imagery": WorldImagery,
            "Open street map" : OpenStreetMap
        };

        function bindMap() {
            TentMap = L.map("map").setView([63.412222, 10.404722], 4);
        }

        function addLayerToMap(layer) {
            layer.addTo(TentMap);
        }

        function addLayersToMap(layers) {
            L.control.layers(layers).addTo(TentMap);
        }

        function placeSites(tentSites) {
            var photoLayer = L.photo.cluster().on("click", function (evt) {
                var photo = evt.layer.photo,
                    template = '<img src="{img_location}" /></a><p>{caption}</p>';
                if (photo.video &&
                    (!!document.createElement("video").canPlayType("video/mp4; codecs=avc1.42E01E,mp4a.40.2"))
                ) {
                    template = '<video autoplay controls poster="{img_location}">' +
                        '<source src="{video}" type="video/mp4"/></video>';
                }
                evt.layer.bindPopup(L.Util.template(template, photo), {
                    className: "leaflet-popup-photo"
                }).openPopup();
            });
            photoLayer.add(tentSites).addTo(TentMap);
        }

        function markLocation(latitude, longitude, accuracy) {
            if(locationCircle) {
                TentMap.removeLayer(locationCircle);
            }
            locationCircle = L.circle([latitude, longitude], accuracy, {
                color: "red",
                fillColor: "#f03",
                fillOpacity: 0.5
            }).addTo(TentMap);
        }

        return {
            initialize: function() {
                if(loaded === true) {
                    TentMap.invalidateSize();
                    return;
                }
                loaded = true;
                bindMap();
                addLayerToMap(OpenStreetMap);
                addLayersToMap(baseMaps);

                $map = $("#map");

                // Add view position button
                L.easyButton({
                    position: "topleft",
                    states: [{
                        icon: "fa-crosshairs",
                        title: "View my position",
                        onClick: function(button, map) {
                            map.locate();
                        }
                    }]
                }).addTo(TentMap);

                TentMap.on("locationfound", function(event) {
                    markLocation(event.latlng.lat, event.latlng.lng, event.accuracy);
                    TentMap.setView(event.latlng, 10);
                });

                TentMap.on("locationerror", function(event) {
                    alert("Could not find your location. Please turn on gps and try again");
                });

                sites.onFetchedSites(function(sites) {
                    placeSites(sites);
                });
            },
            updateView: function(latitude, longitude) {
                if(!latitude || !longitude) {
                    return false;
                }
                if(!loaded) {
                    this.initialize();
                }
                TentMap.panTo(
                    new L.LatLng(latitude, longitude),
                    {animate: true, duration: 0.2, noMoveStart: true, easyLinearity: 0.25}
                );
            },
            destruct: function() {

            }
        }
    }

    function Wall() {
        var $wall = $("#wall"),
            $wallImageContainer = $("#wall-images"),
            $wallFullscreen = $("#wall-fullscreen"),
            $wallLoadMore = $("#wall-load-more"),
            $preLoadedContainers = $wallImageContainer.find(".wall-image-container"),
            index = $preLoadedContainers.index(),
            loaded = false;

        function createImageWall(sites) {
            $.each(sites, function(key, photo) {
                var $container = $preLoadedContainers.eq(index);
                index++;
                if($container.length === 0) {
                    $container = $("<div>").addClass("wall-image-container").appendTo($wallImageContainer);
                }

                $container.attr("data-image-id", photo.id)
                    .attr("data-image-latitude", photo.lat)
                    .attr("data-image-longitude", photo.lng)
                    .attr("data-image-location", photo.img_location);

                $container.append($("<img>").attr("src", photo.img_location));
                $container.append('<div class="wall-image-controllers is-hidden">' +
                    '<i class="wall-image-view-map fa fa-map-marker" title="View image on map"></i>' +
                    '<i class="wall-image-enlarge fa fa-arrows-alt fa-3x" title="Enlarge image"></i>' +
                    '</div>');
            });

            $(".wall-image-view-map").on("click", function(e) {
                e.stopPropagation();
                var $photoContainer = $(this).closest(".wall-image-container");
                if($photoContainer.hasClass("reveal")) {
                    $photoContainer.foundation("close");
                }
                view.changePage("map");
                map.updateView($photoContainer.data("image-latitude"), $photoContainer.data("image-longitude"));
            });

            $(".wall-image-enlarge").on("click", function(e) {
                e.stopPropagation();
                var $photoContainer = $(this).closest(".wall-image-container");
                $wallFullscreen.attr("data-image-latitude", $photoContainer.data("image-latitude")).
                    attr("data-image-longitude", $photoContainer.data("image-longitude"));
                $wallFullscreen.find("img").attr("src", $photoContainer.data("image-location"));
                $wallFullscreen.foundation("open");
            });

            // Support for non-mouse interaction
            $(document).on("click", ".wall-image-container", function(e) {
                e.stopPropagation();
                $(this).find(".wall-image-controllers").toggleClass("is-hidden");
            });
            $(document).on("mouseover", ".wall-image-container", function(e) {
                e.stopPropagation();
                $(this).find(".wall-image-controllers").removeClass("is-hidden");
            });
            $(document).on("mouseout", ".wall-image-container", function(e) {
                e.stopPropagation();
                $(this).find(".wall-image-controllers").addClass("is-hidden");
            });
        }

        return {
            initialize: function() {
                if(loaded === false) {
                    loaded = true;
                    sites.onFetchedSites(function(sites) {
                        createImageWall(sites);
                        $wallLoadMore.removeClass("is-hidden");
                    });

                    $wallLoadMore.on("click", function() {
                        sites.onFetchedSites(function(sites) {
                            createImageWall(sites);
                        });
                        $wall.animate({scrollTop: $wall.prop("scrollHeight") - 80}, 1000);
                    });
                }
            },
            destruct: function() {
            }
        }
    }

    function Camera() {
        var $photo, $shutter, $cancel, $store, $location, location = null, $uploader, $uploaderLabel,
            loaded = false, options = {target: "upload.php"};

        function extractBase64FromDataUri(data_uri) {
            return data_uri.replace(/^data\:image\/\w+\;base64\,/, '');
        }

        function uploadPicture(photo, callback) {
            $.ajax({
                url: options.target,
                method: "POST",
                data: {
                    photo: photo,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    caption: $("#camera-photo-caption").val(),
                    title: " "
                }
            }).success(function(response) {
                callback(200, response);
            }).error(function(response) {
                callback(400, response);
            });
        }

        function storePicture(callback) {
            if(typeof $uploader.prop("files") !== typeof undefined) {
                var fileReader = new FileReader();
                fileReader.addEventListener("load", function(e) {
                    uploadPicture(fileReader.result, callback);
                });
                fileReader.readAsDataURL($uploader.prop("files")[0]);
            } else {
                Webcam.snap(function(data_uri) {
                    uploadPicture(extractBase64FromDataUri(data_uri), callback);
                });
            }
        }

        function togglePhotoControllers() {
            $store.toggleClass("is-hidden");
            $shutter.toggleClass("is-hidden");
            $cancel.toggleClass("is-hidden");
            $uploaderLabel.toggleClass("is-hidden");
        }

        function clearPhotoDetails() {
            $("#camera-photo-caption").val("");
            clearLocation();
        }

        function clearLocation() {
            $location.removeData("location");
            $location.toggleClass("success");
            location = null;
        }

        function setLocation(lat, lng, accuracy) {
            $location.data("location", true).addClass("success").attr("title", "Location found");
            location = {
                latitude: lat,
                longitude: lng,
                accuracy: accuracy
            };
        }

        function setupCameraAndListeners() {
            $photo = $("#camera-photo");
            $shutter = $("#camera-photo-shutter");
            $location = $("#camera-photo-location");
            $cancel = $("#camera-photo-cancel");
            $store = $("#camera-photo-store");
            $uploader = $("#camera-photo-file");
            $uploaderLabel = $('label[for="camera-photo-file"]');

            $shutter.on("click", function() {
                if(Webcam.loaded === false) {
                    return;
                }
                Webcam.freeze();
                togglePhotoControllers();
            });

            $cancel.on("click", function() {
                Webcam.unfreeze();
                clearPhotoDetails();
                togglePhotoControllers();
            });

            $store.on("click", function() {
                if(!location) {
                    return false;
                }
                storePicture(function(code, text) {
                    if(code === 200) {
                        clearPhotoDetails();
                        togglePhotoControllers();
                    } else {
                        // Todo: Add some information to user - try again
                    }
                });
            });

            $location.on("click", function() {
                if(!$(this).data("location")) {
                    if(typeof navigator.geolocation === typeof undefined) {
                        $location.addClass("warning");
                        $(this).data("location", false);
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(function(position) {
                        setLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
                    }, function() {
                        $location.addClass("warning");
                        $(this).data("location", false);
                    });
                } else {
                    $location.addClass("secondary");
                    location = null;
                }
            });

            $uploader.on("change", function() {
                EXIF.getData($(this).prop("files")[0], function() {
                    if(typeof EXIF.getTag(this, 'GPSLatitude') === typeof undefined) {
                        // Throw error as this image does not have required EXIF data
                        console.log("Photo does not have valid exif data");
                        return false;
                    }

                    var exifData = EXIF.getAllTags(this),
                        lat = exifData.GPSLatitude,
                        lng = exifData.GPSLongitude;

                    // Convert coordinates to WGS84 decimal
                    var latRef = exifData.GPSLatitudeRef || "N";
                    var lngRef = exifData.GPSLongitudeRef || "W";
                    lat = (lat[0] + lat[1]/60 + lat[2]/3600) * (latRef == "N" ? 1 : -1);
                    lng = (lng[0] + lng[1]/60 + lng[2]/3600) * (lngRef == "W" ? -1 : 1);

                    setLocation(lat, lng);
                    togglePhotoControllers();
                });
            });
        }

        return {
            initialize: function() {
                Webcam.attach("#camera-photo");
                if(!loaded) {
                    loaded = true;
                    setupCameraAndListeners();
                }
            },
            destruct: function() {
                if(Webcam.userMedia) {
                    Webcam.reset();
                }
            }
        }
    }

    function View() {
        var $currentPage, $currentPageContent, currentPageName;

        function toggleCurrentPage() {
            if(typeof $currentPage !== typeof undefined) {
                $currentPage.toggleClass("is-active");
                $currentPageContent.toggleClass("is-hidden");
            }
        }

        function destructCurrentPage() {
            toggleCurrentPage();
            if(typeof currentPageName !== typeof undefined) {
                if(currentPageName == "camera") {
                    camera.destruct();
                } else if(currentPageName == "map") {
                    map.destruct();
                } else if(currentPageName == "wall") {
                    wall.destruct();
                }
            }
        }

        function initializeCurrentPage() {
            toggleCurrentPage();
            if(typeof currentPageName !== typeof undefined) {
                if(currentPageName == "camera") {
                    camera.initialize();
                } else if(currentPageName == "map") {
                    map.initialize();
                } else if(currentPageName == "wall") {
                    wall.initialize();
                }
            }
        }

        function setCurrentPage($page, pageName) {
            if(pageName === currentPageName) {
                return;
            }
            destructCurrentPage();
            localStorage.setItem("App.View.currentPage", pageName);
            $currentPage = $page;
            $currentPageContent = getPageContentObject(pageName);
            currentPageName = pageName;
            initializeCurrentPage();
        }

        function getPageContentObject(page) {
            return $("#content").find('#' + page);
        }

        function findPageByName(pageName) {
            return $("#menu").find('li[data-page="'+pageName+'"]');
        }

        return {
            initialize: function() {
                sites = new Sites();
                camera = new Camera();
                map = new Map();
                wall = new Wall();
                var $menu = $("#menu");
                var tmpPageName = localStorage.getItem("App.View.currentPage");
                if(!tmpPageName) {
                    tmpPageName =  $menu.data("page-default");
                }
                setCurrentPage(findPageByName(tmpPageName), tmpPageName);

                $menu.on("click", "li", function() {
                    var $page = $(this);
                    setCurrentPage($page, $page.data("page"));
                });
            },
            changePage: function(pageName) {
                setCurrentPage(findPageByName(pageName), pageName);
            }
        }
    }

    view = new View();
    view.initialize();

    $(document).foundation();
})(jQuery);