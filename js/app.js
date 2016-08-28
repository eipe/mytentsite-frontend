/**
 * Created by Eivind Røe <eivindroe@gmail.com> on 06.08.2016.
 */
(function($) {
    'use strict';
    var view, map, wall, sites;

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
                if(loaded === false) {
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
                        console.log(event.message);
                    });

                    sites.onFetchedSites(function(sites) {
                        placeSites(sites);
                    });
                }
            }
        }
    }

    function Wall() {
        var $wall = $("#wall"),
            loaded = false;

        function createImageWall(sites) {
            $.each(sites, function(key, photo) {
                $wall.append('<div>' +
                    '<img src="'+photo.img_location+'" data-image-id="'+photo.id+'" data-image-latitude="'+
                    photo.lat+'" data-image-longitude="'+photo.lng+'" />' +
                    '</div>');
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
            }
        }
    }

    function View() {
        var $currentPage, $currentPageContent, currentPageName;

        function toggleCurrentPage() {
            if(typeof $currentPage !== typeof undefined) {
                $currentPage.toggleClass("is-active");
                $currentPageContent.toggleClass("is-hidden");
                if(currentPageName == "map") {
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
            toggleCurrentPage();
            localStorage.setItem("App.View.currentPage", pageName);
            $currentPage = $page;
            $currentPageContent = getPageContentObject(pageName);
            currentPageName = pageName;
            toggleCurrentPage();
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
            }
        }
    }

    view = new View();
    view.initialize();

    $(document).foundation();
})(jQuery);