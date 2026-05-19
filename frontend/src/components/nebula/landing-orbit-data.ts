export interface OrbitUser {
  name: string;
  avatar: string;
  /** Number of mutual servers (shown as badge label) */
  label: string;
  radius: string;
  speed: string;
  delay: string;
  online: boolean;
}

/**
 * Static data for the orbit visualisation.
 *
 * Geometry notes:
 *   far  ring ≈ 216 px radius (90 % of 480 px stage / 2), period 60 s
 *   mid  ring ≈ 156 px radius (65 %),                      period 45 s
 *   near ring ≈  91 px radius (38 %),                      period 30 s
 *
 * delay = -(startAngleDeg / 360) * speed  → places avatar at correct
 * start position at t=0 without a jump.
 */
export const ORBIT_USERS: OrbitUser[] = [
  { name: "AK", avatar: "/avatars/avatar_ak.png", label: "1", radius: "216px", speed: "60s", delay: "-45s",    online: false }, // far,  top        270°
  { name: "SL", avatar: "/avatars/avatar_sl.png", label: "2", radius: "156px", speed: "45s", delay: "-37.5s",  online: false }, // mid,  top-left   300°
  { name: "MR", avatar: "/avatars/avatar_mr.png", label: "2", radius: "156px", speed: "45s", delay: "-22.5s",  online: false }, // mid,  left       180°
  { name: "JT", avatar: "/avatars/avatar_jt.png", label: "1", radius: "216px", speed: "60s", delay: "-20s",    online: false }, // far,  bottom-left 120°
  { name: "EV", avatar: "/avatars/avatar_ev.png", label: "3", radius:  "91px", speed: "30s", delay: "0s",      online: true  }, // near, right         0°
  { name: "NB", avatar: "/avatars/avatar_nb.png", label: "2", radius: "156px", speed: "45s", delay: "-11.25s", online: false }, // mid,  bottom       90°
];
