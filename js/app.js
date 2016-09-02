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
            if(localStorage.getItem("Sites.all")) {
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
                        localStorage.setItem("Sites.lastFetchTime", getTime());
                        localStorage.setItem("Sites.all", JSON.stringify(tentSites));
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
            loaded = false;

        function createImageWall(sites) {
            $.each(sites, function(key, photo) {
                $wall.append('<div class="wall-image-container" ' +
                    'data-image-id="'+photo.id+'" data-image-latitude="'+photo.lat+'" ' +
                    'data-image-longitude="'+photo.lng+'" data-full-size="'+photo.img_location+'">' +
                    '<img src="'+photo.img_location+'" />' +
                    '<div class="wall-image-controllers">' +
                    '<i class="wall-image-view-map fa fa-map-marker" title="View image on map"></i>' +
                    '<i class="wall-image-enlarge fa fa-arrows-alt fa-3x" title="Enlarge image"></i>' +
                    '</div></div>'
                );
            });

            $wall.on("click", ".wall-image-view-map", function(e) {
                e.stopPropagation();
                var $photoContainer = $(this).closest(".wall-image-container");
                view.changePage("map");
                map.updateView($photoContainer.data("image-latitude"), $photoContainer.data("image-longitude"));
            });

            // Support for non-mouse interaction
            $wall.on("click", ".wall-image-container", function(e) {
                e.stopPropagation();
                $(this).toggleClass("wall-image-focus");
            });
        }

        return {
            initialize: function() {
                if(loaded === false) {
                    loaded = true;
                    sites.onFetchedSites(function(sites) {
                        createImageWall(sites);
                    });
                }
            },
            destruct: function() {
            }
        }
    }

    function Camera() {
        var $photo, $shutter, $cancel, $store, $location, location, loaded = false;

        function uploadPicture(callback) {
            Webcam.snap(function(data_uri) {
                Webcam.upload(data_uri, 'upload.php', function(code, text) {
                    callback(code, text);
                });
            });
        }

        function togglePhotoControllers() {
            $store.toggleClass("is-hidden");
            $shutter.toggleClass("is-hidden");
            $cancel.toggleClass("is-hidden");
        }

        function clearPhotoDetails() {
            $("#camera-photo-caption").val("");
            $location.removeAttr("location");
            $location.toggleClass("success");
        }

        function setupCameraAndListeners() {
            $photo = $("#camera-photo");
            $shutter = $("#camera-photo-shutter");
            $location = $("#camera-photo-location");
            $cancel = $("#camera-photo-cancel");
            $store = $("#camera-photo-store");
            $shutter.on("click", function() {
                Webcam.freeze();
                togglePhotoControllers();
            });

            $cancel.on("click", function() {
                Webcam.unfreeze();
                togglePhotoControllers();
            });

            $store.on("click", function() {
                uploadPicture(function(code, text) {
                    clearPhotoDetails();
                    togglePhotoControllers();
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
                        $(this).data("location", true);
                        $location.addClass("success").attr("title", "Location found");
                        location = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        };
                    }, function() {
                        $location.addClass("warning");
                        $(this).data("location", false);
                    });
                } else {
                    $location.addClass("secondary");
                    location = null;
                }
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
                Webcam.reset();
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