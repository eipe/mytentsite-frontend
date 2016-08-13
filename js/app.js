/**
 * Created by Eivind Røe <eivindroe@gmail.com> on 06.08.2016.
 */
var Map = (function() {
    var TentMap = L.map("map-tent-sites").setView([63.412222, 10.404722], 4),
        locationCircle;

    // Add main layer
    L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: ["a","b","c"]
    }).addTo(TentMap);

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
        if(locationCircle) {
            TentMap.removeLayer(locationCircle);
        }
        TentMap.setView(event.latlng, 10);
        locationCircle = L.circle(event.latlng, event.accuracy, {
            color: "red",
            fillColor: "#f03",
            fillOpacity: 0.5
        }).addTo(TentMap);
    });

    TentMap.on("locationerror", function(event) {
        alert("Could not find your location. Please turn on gps and try again");
        console.log(event.message);
    });

    return {
        "initialize" : function() {
            return this;
        },
        "placeSites" : function(tentSites) {
            var photoLayer = L.photo.cluster().on('click', function (evt) {
                var photo = evt.layer.photo,
                    template = '<img src="{img_location}" width="300" height="300" /></a><p>{caption}</p>';
                if (photo.video &&  (!!document.createElement('video').canPlayType("video/mp4; codecs=avc1.42E01E,mp4a.40.2"))) {
                    template = '<video autoplay controls poster="{img_location}" width="300" height="300">' +
                        '<source src="{video}" type="video/mp4"/></video>';
                }
                evt.layer.bindPopup(L.Util.template(template, photo), {
                    className: "leaflet-popup-photo",
                    minWidth: 300
                }).openPopup();
            });
            photoLayer.add(tentSites).addTo(TentMap);
            //TentMap.fitBounds(photoLayer.getBounds());
        }
    }
})(jQuery);

var Sites = (function($) {
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
})(jQuery);

function getTime() {
    if(typeof Date.now !== typeof undefined) {
        return Date.now();
    } else {
        // Fallback for IE8
        return new Date().getTime();
    }
}

(function() {
    Sites.onFetchedSites(function (sites) { Map.placeSites(sites) });
})();