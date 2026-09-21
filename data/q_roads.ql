[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary)$"](37.70,-122.53,37.84,-122.35);
  way["highway"~"^(motorway|trunk)$"](37.66,-122.62,37.95,-122.16);
);
out geom;
