import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { LatLng, latLngBounds, Map } from 'leaflet';
import { makeStyles } from '@mui/styles';
import { Add, GpsNotFixed, Remove } from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AttributionControl,
  MapContainer,
  Polygon,
  TileLayer,
} from 'react-leaflet';

import { ZetkinArea, ZetkinPlace } from '../types';
import { Msg } from 'core/i18n';
import messageIds from '../l10n/messageIds';
import { DivIconMarker } from 'features/events/components/LocationModal/DivIconMarker';
import usePlaces from '../hooks/usePlaces';
import PlaceDialog from './PlaceDialog';
import { PlaceCard } from './PlaceCard';

const useStyles = makeStyles((theme) => ({
  '@keyframes ghostMarkerBounce': {
    '0%': {
      top: -20,
      transform: 'scale(1, 0.8)',
    },
    '100%': {
      top: -40,
      transform: 'scale(0.9, 1)',
    },
  },
  actionAreaContainer: {
    bottom: 15,
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    padding: 8,
    position: 'absolute',
    width: '100%',
    zIndex: 1000,
  },
  crosshair: {
    left: '50%',
    position: 'absolute',
    top: '40vh',
    transform: 'translate(-50%, -50%)',
    transition: 'opacity 0.1s',
    zIndex: 1200,
  },
  ghostMarker: {
    animationDirection: 'alternate',
    animationDuration: '0.4s',
    animationIterationCount: 'infinite',
    animationName: '$ghostMarkerBounce',
    animationTimingFunction: 'cubic-bezier(0,.71,.56,1)',
    position: 'absolute',
    zIndex: 1000,
  },
  infoButtons: {
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.grey[300]}`,
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    width: '90%',
  },
  zoomControls: {
    backgroundColor: theme.palette.common.white,
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
    left: 10,
    marginTop: 10,
    position: 'absolute',
    zIndex: 1000,
  },
}));

type PublicAreaMapProps = {
  area: ZetkinArea;
};

const PublicAreaMap: FC<PublicAreaMapProps> = ({ area }) => {
  const theme = useTheme();
  const classes = useStyles();
  const places = usePlaces(area.organization.id).data || [];

  const [selectedPlace, setSelectedPlace] = useState<ZetkinPlace | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [dialogStep, setDialogStep] = useState<'place' | 'log'>('place');
  const [returnToMap, setReturnToMap] = useState(false);
  const [standingStill, setStandingStill] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);

  const [map, setMap] = useState<Map | null>(null);
  const crosshairRef = useRef<HTMLDivElement | null>(null);
  const standingStillTimerRef = useRef(0);

  const showViewPlaceButton = !!selectedPlace && !anchorEl;

  const updateSelection = useCallback(() => {
    let nearestPlace: ZetkinPlace | null = null;
    let nearestDistance = Infinity;

    const crosshair = crosshairRef.current;

    if (map && crosshair) {
      const mapContainer = map.getContainer();
      const markerRect = crosshair.getBoundingClientRect();
      const mapRect = mapContainer.getBoundingClientRect();
      const x = markerRect.x - mapRect.x;
      const y = markerRect.y - mapRect.y;
      const markerX = x + 0.5 * markerRect.width;
      const markerY = y + 0.5 * markerRect.height;

      places.forEach((place) => {
        const screenPos = map.latLngToContainerPoint(place.position);
        const dx = screenPos.x - markerX;
        const dy = screenPos.y - markerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestPlace = place;
        }
      });

      if (nearestDistance < 20) {
        if (nearestPlace != selectedPlace) {
          setSelectedPlace(nearestPlace);
        }
      } else {
        setSelectedPlace(null);
      }
    }
  }, [map, selectedPlace, places]);

  const panTo = useCallback(
    (pos: LatLng) => {
      const crosshair = crosshairRef.current;
      if (crosshair && map) {
        const mapContainer = map.getContainer();
        const mapRect = mapContainer.getBoundingClientRect();
        const markerRect = crosshair.getBoundingClientRect();
        const x = markerRect.x - mapRect.x;
        const y = markerRect.y - mapRect.y;
        const markerPoint: [number, number] = [
          x + 0.5 * markerRect.width,
          y + 0.8 * markerRect.height,
        ];

        const crosshairPos = map.containerPointToLatLng(markerPoint);
        const centerPos = map.getCenter();
        const latOffset = centerPos.lat - crosshairPos.lat;
        const lngOffset = centerPos.lng - crosshairPos.lng;
        const adjustedPos = new LatLng(
          pos.lat + latOffset,
          pos.lng + lngOffset
        );
        map.panTo(adjustedPos, { animate: true });
      }
    },
    [map, crosshairRef.current]
  );

  useEffect(() => {
    if (map) {
      map.on('click', (evt) => {
        panTo(evt.latlng);
      });

      map.on('movestart', () => {
        window.clearTimeout(standingStillTimerRef.current);
        setStandingStill(false);
      });

      map.on('move', () => {
        updateSelection();
      });

      map.on('moveend', () => {
        // When the map contains no places, show the bouncy marker
        // quickly, but once there are places, wait longer before
        // showing the bouncy marker.
        const delay = places.length ? 10000 : 1300;

        standingStillTimerRef.current = window.setTimeout(
          () => setStandingStill(true),
          delay
        );
      });

      return () => {
        map.off('move');
        map.off('moveend');
        map.off('movestart');
      };
    }
  }, [map, selectedPlace, places, panTo, updateSelection]);

  useEffect(() => {
    updateSelection();
  }, [places]);

  return (
    <>
      <Box className={classes.zoomControls}>
        <IconButton onClick={() => map?.zoomIn()}>
          <Add />
        </IconButton>
        <Divider flexItem variant="fullWidth" />
        <IconButton onClick={() => map?.zoomOut()}>
          <Remove />
        </IconButton>
      </Box>
      <Box position="relative">
        <Box
          ref={crosshairRef}
          className={classes.crosshair}
          sx={{
            opacity: !selectedPlace ? 1 : 0.3,
          }}
        >
          {!selectedPlace && !showCard && (
            <Box
              className={classes.ghostMarker}
              sx={{
                opacity: standingStill ? 1 : 0,
                transition: `opacity ${standingStill ? 0.8 : 0.2}s`,
              }}
            >
              <svg fill="none" height="35" viewBox="0 0 30 40" width="25">
                <path
                  d="M14 38.479C13.6358 38.0533 13.1535 37.4795
                12.589 36.7839C11.2893 35.1826 9.55816 32.9411
                7.82896 30.3782C6.09785 27.8124 4.38106 24.9426
                3.1001 22.0833C1.81327 19.211 1 16.4227 1 14C1
                6.81228 6.81228 1 14 1C21.1877 1 27 6.81228 27 14C27
                16.4227 26.1867 19.211 24.8999 22.0833C23.6189 24.9426
                21.9022 27.8124 20.171 30.3782C18.4418 32.9411 16.7107
                35.1826 15.411 36.7839C14.8465 37.4795 14.3642
                38.0533 14 38.479Z"
                  fill="#ED1C55"
                  stroke="#ED1C55"
                  strokeWidth="2"
                />
              </svg>
            </Box>
          )}
          {!selectedPlace && showCard && (
            <Box
              className={classes.ghostMarker}
              sx={{
                opacity: 1,
                transition: `opacity  0.8s`,
              }}
            >
              <svg fill="none" height="35" viewBox="0 0 30 40" width="25">
                <path
                  d="M14 38.479C13.6358 38.0533 13.1535 37.4795
                12.589 36.7839C11.2893 35.1826 9.55816 32.9411
                7.82896 30.3782C6.09785 27.8124 4.38106 24.9426
                3.1001 22.0833C1.81327 19.211 1 16.4227 1 14C1
                6.81228 6.81228 1 14 1C21.1877 1 27 6.81228 27 14C27
                16.4227 26.1867 19.211 24.8999 22.0833C23.6189 24.9426
                21.9022 27.8124 20.171 30.3782C18.4418 32.9411 16.7107
                35.1826 15.411 36.7839C14.8465 37.4795 14.3642
                38.0533 14 38.479Z"
                  fill="#ED1C55"
                  stroke="#ED1C55"
                  strokeWidth="2"
                />
              </svg>
            </Box>
          )}
          <GpsNotFixed />
        </Box>
      </Box>
      <Box className={classes.actionAreaContainer}>
        {showViewPlaceButton && (
          <Box className={classes.infoButtons}>
            <Typography sx={{ paddingBottom: 1 }}>
              {selectedPlace.title || <Msg id={messageIds.place.empty.title} />}
            </Typography>
            <Box display="flex" gap={1}>
              <Button
                fullWidth
                onClick={(ev) => {
                  setAnchorEl(ev.currentTarget);
                  setDialogStep('place');
                }}
                variant="outlined"
              >
                <Msg id={messageIds.viewPlaceButton} />
              </Button>
              <Button
                fullWidth
                onClick={(ev) => {
                  setAnchorEl(ev.currentTarget);
                  setDialogStep('log');
                  setReturnToMap(true);
                }}
                variant="contained"
              >
                <Msg id={messageIds.place.logActivityButton} />
              </Button>
            </Box>
          </Box>
        )}
        {!selectedPlace && !showCard && (
          <Button
            onClick={() => {
              const crosshair = crosshairRef.current;
              const mapContainer = map?.getContainer();
              if (crosshair && mapContainer) {
                const mapRect = mapContainer.getBoundingClientRect();
                const markerRect = crosshair.getBoundingClientRect();
                const x = markerRect.x - mapRect.x;
                const y = markerRect.y - mapRect.y;
                const markerPoint: [number, number] = [
                  x + 0.5 * markerRect.width,
                  y + 0.8 * markerRect.height,
                ];

                const point = map?.containerPointToLatLng(markerPoint);
                setPoint(point ?? null);
                setShowCard(true);
              }
            }}
            variant="contained"
          >
            <Msg id={messageIds.addNewPlaceButton} />
          </Button>
        )}
      </Box>
      <MapContainer
        ref={(map) => setMap(map)}
        attributionControl={false}
        bounds={latLngBounds(area.points)}
        minZoom={1}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution="<span style='color:#a3a3a3;'>Leaflet & OpenStreetMap</span>"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polygon color={theme.palette.primary.main} positions={area.points} />
        <>
          {places.map((place) => {
            const selected = place.id == selectedPlace?.id;
            const key = `marker-${place.id}-${selected.toString()}`;

            return (
              <DivIconMarker
                key={key}
                eventHandlers={{
                  click: (evt) => {
                    panTo(evt.latlng);
                  },
                }}
                iconAnchor={[11, 33]}
                position={{
                  lat: place.position.lat,
                  lng: place.position.lng,
                }}
              >
                <svg fill="none" height="35" viewBox="0 0 30 40" width="25">
                  <path
                    d="M14 38.479C13.6358 38.0533 13.1535 37.4795
           12.589 36.7839C11.2893 35.1826 9.55816 32.9411
            7.82896 30.3782C6.09785 27.8124 4.38106 24.9426
            3.1001 22.0833C1.81327 19.211 1 16.4227 1 14C1
            6.81228 6.81228 1 14 1C21.1877 1 27 6.81228 27 14C27
            16.4227 26.1867 19.211 24.8999 22.0833C23.6189 24.9426
            21.9022 27.8124 20.171 30.3782C18.4418 32.9411 16.7107
            35.1826 15.411 36.7839C14.8465 37.4795 14.3642
            38.0533 14 38.479Z"
                    fill={selected ? '#ED1C55' : 'white'}
                    stroke="#ED1C55"
                    strokeWidth="2"
                  />
                </svg>
              </DivIconMarker>
            );
          })}
        </>
      </MapContainer>
      {selectedPlace && (
        <PlaceDialog
          dialogStep={dialogStep}
          onClose={() => {
            setAnchorEl(null);
            setSelectedPlace(null);
          }}
          onLogCancel={() => {
            if (returnToMap) {
              setAnchorEl(null);
            } else {
              setDialogStep('place');
            }
          }}
          onLogSave={() => setDialogStep('place')}
          onLogStart={() => {
            setDialogStep('log');
            setReturnToMap(false);
          }}
          open={!!anchorEl}
          orgId={area.organization.id}
          place={selectedPlace}
        />
      )}
      {showCard && (
        <PlaceCard
          onClose={() => {
            setShowCard(false);
          }}
          orgId={area.organization.id}
          point={point}
        />
      )}
    </>
  );
};

export default PublicAreaMap;
