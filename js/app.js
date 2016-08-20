/**
 * Created by Eivind Røe <eivindroe@gmail.com> on 06.08.2016.
 */
(function($) {
    'use strict';
    var viewMode;

    function getViewMode() {
        if(viewMode) {
            return viewMode;
        }

        if(localStorage.getItem("App.viewMode")) {
            viewMode = localStorage.getItem("App.viewMode");
            return viewMode;
        } else {
            // Map is the default view mode
            viewMode = "map";
        }
    }

    function toggleViewMode() {
        var currentViewMode = getViewMode();
        if(currentViewMode == "map") {
            viewMode = "wall";
        } else {
            viewMode = "map";
        }
        localStorage.setItem("App.viewMode", viewMode);

        if(getViewMode() == "map") {
            Wall.hide();
            Map.show();
        } else if(getViewMode() == "wall") {
            Map.hide();
            Wall.show();
        }
    }

    function getTime() {
        if(typeof Date.now !== typeof undefined) {
            return Date.now();
        } else {
            // Fallback for IE8
            return new Date().getTime();
        }
    }

    var Sites = (function() {
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
    })();

    function Map() {
        var TentMap,
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
            TentMap = L.map("map-tent-sites").setView([63.412222, 10.404722], 4);
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
                    template = '<img src="{img_location}" width="300" height="300" /></a><p>{caption}</p>';
                if (photo.video && (!!document.createElement("video").canPlayType("video/mp4; codecs=avc1.42E01E,mp4a.40.2"))) {
                    template = '<video autoplay controls poster="{img_location}" width="300" height="300">' +
                        '<source src="{video}" type="video/mp4"/></video>';
                }
                evt.layer.bindPopup(L.Util.template(template, photo), {
                    className: "leaflet-popup-photo",
                    minWidth: 300
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
                bindMap();
                addLayerToMap(OpenStreetMap);
                addLayersToMap(baseMaps);

                Sites.onFetchedSites(function(sites) {
                    placeSites(sites);
                });

                $map = $("#map-tent-sites");

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
                    console.log(event.message);
                });

                if(getViewMode() == "map") {
                    this.show();
                } else {
                    this.hide();
                }
            },
            show: function() {
                $map.css("visibility", "visible");
            },
            hide: function() {
                $map.css("visibility", "hidden");
            }
        }
    }

    function Wall() {
        var $wall = $("#wall");

        return {
            initialize: function() {
                if(getViewMode() == "wall") {
                    this.show();
                } else {
                    this.hide();
                }
            },
            show: function() {
                $wall.css("visibility", "visible");
            },
            hide: function() {
                $wall.css("visibility", "hidden");
            }
        }
    }

    Map = new Map();
    Map.initialize();

    Wall = new Wall();
    Wall.initialize();

    function handleViewChange($controller) {
        var $toggleIcon = $controller.find("i");
        if(getViewMode() == "map") {
            $toggleIcon.attr("class", $toggleIcon.data("icon-map"));
        } else {
            $toggleIcon.attr("class", $toggleIcon.data("icon-wall"));
        }
    }

    var $viewController = $("#view-controller");

    // Load initial state
    handleViewChange($viewController);

    // Handle change
    $viewController.on("click", function() {
        toggleViewMode();
        handleViewChange($(this));
    });
})(jQuery);