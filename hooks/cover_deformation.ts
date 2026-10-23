import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react';

const DRAG_THRESHOLD_PX = 4;

type CoverDeformation = [number, number, number, number, number, number];

const RESTING_DEFORMATION: CoverDeformation = [1, 0, 0, 1, 0, 0];

export function useCoverDeformation<T extends HTMLElement>(
  cover_ref: RefObject<T | null>,
  reduced_motion: boolean,
  on_activate?: (event: MouseEvent<T>) => void
) {
  const drag_ref = useRef<{
    pointer_id: number | null;
    start_x: number;
    start_y: number;
    width: number;
    height: number;
    dragged: boolean;
  }>({ pointer_id: null, start_x: 0, start_y: 0, width: 1, height: 1, dragged: false });
  const suppress_click_ref = useRef(false);
  const motion_ref = useRef<{
    current: CoverDeformation;
    target: CoverDeformation;
    velocity: CoverDeformation;
    frame: number | null;
    last_time: number;
  }>({
    current: [...RESTING_DEFORMATION],
    target: [...RESTING_DEFORMATION],
    velocity: [0, 0, 0, 0, 0, 0],
    frame: null,
    last_time: 0
  });

  const write_deformation = (values: CoverDeformation) => {
    const cover = cover_ref.current;
    if (!cover) return;
    cover.style.setProperty('--cover-deform-a', values[0].toFixed(5));
    cover.style.setProperty('--cover-deform-b', values[1].toFixed(5));
    cover.style.setProperty('--cover-deform-c', values[2].toFixed(5));
    cover.style.setProperty('--cover-deform-d', values[3].toFixed(5));
    cover.style.setProperty('--cover-drag-x', `${values[4].toFixed(3)}px`);
    cover.style.setProperty('--cover-drag-y', `${values[5].toFixed(3)}px`);
  };

  const animate_deformation = (time: number) => {
    const motion = motion_ref.current;
    const elapsed =
      motion.last_time === 0 ? 1 / 60 : Math.min((time - motion.last_time) / 1000, 0.032);
    const dragging = drag_ref.current.pointer_id !== null;
    const stiffness = dragging ? 250 : 165;
    const damping = dragging ? 19 : 7;
    let settled = !dragging;

    motion.last_time = time;
    for (let index = 0; index < motion.current.length; index += 1) {
      const displacement = motion.target[index] - motion.current[index];
      motion.velocity[index] += displacement * stiffness * elapsed;
      motion.velocity[index] *= Math.exp(-damping * elapsed);
      motion.current[index] += motion.velocity[index] * elapsed;

      const position_tolerance = index < 4 ? 0.0005 : 0.04;
      const velocity_tolerance = index < 4 ? 0.005 : 0.4;
      if (
        Math.abs(displacement) > position_tolerance ||
        Math.abs(motion.velocity[index]) > velocity_tolerance
      ) {
        settled = false;
      }
    }

    write_deformation(motion.current);

    if (settled) {
      motion.current = [...RESTING_DEFORMATION];
      motion.target = [...RESTING_DEFORMATION];
      motion.velocity = [0, 0, 0, 0, 0, 0];
      motion.frame = null;
      motion.last_time = 0;
      write_deformation(motion.current);
      cover_ref.current?.classList.remove('xe_cover--deforming');
      return;
    }

    motion.frame = window.requestAnimationFrame(animate_deformation);
  };

  const start_animation = () => {
    const motion = motion_ref.current;
    cover_ref.current?.classList.add('xe_cover--deforming');
    if (motion.frame !== null) return;
    motion.last_time = 0;
    motion.frame = window.requestAnimationFrame(animate_deformation);
  };

  const set_resting_deformation = () => {
    motion_ref.current.target = [...RESTING_DEFORMATION];
    start_animation();
  };

  const begin_drag = (event: PointerEvent<T>) => {
    if (event.button !== 0 || reduced_motion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    drag_ref.current = {
      pointer_id: event.pointerId,
      start_x: event.clientX,
      start_y: event.clientY,
      width: bounds.width,
      height: bounds.height,
      dragged: false
    };
    suppress_click_ref.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const deform = (event: PointerEvent<T>) => {
    const drag = drag_ref.current;
    if (drag.pointer_id !== event.pointerId) return;

    const delta_x = event.clientX - drag.start_x;
    const delta_y = event.clientY - drag.start_y;
    const distance = Math.hypot(delta_x, delta_y);
    if (distance < DRAG_THRESHOLD_PX && !drag.dragged) return;

    drag.dragged = true;
    suppress_click_ref.current = true;
    const direction_x = distance > 0 ? delta_x / distance : 1;
    const direction_y = distance > 0 ? delta_y / distance : 0;
    const strength = Math.min(distance / (Math.min(drag.width, drag.height) * 0.48), 1);
    const stretch = strength * 0.28;
    const squash = strength * 0.1;
    const cross = (stretch + squash) * direction_x * direction_y;
    const max_offset = Math.min(drag.width, drag.height) * 0.12;
    const offset_scale = distance > 0 ? Math.min(distance * 0.18, max_offset) / distance : 0;

    motion_ref.current.target = [
      1 + stretch * direction_x * direction_x - squash * direction_y * direction_y,
      cross,
      cross,
      1 + stretch * direction_y * direction_y - squash * direction_x * direction_x,
      delta_x * offset_scale,
      delta_y * offset_scale
    ];
    start_animation();
  };

  const end_drag = (event: PointerEvent<T>) => {
    const drag = drag_ref.current;
    if (drag.pointer_id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.pointer_id = null;
    set_resting_deformation();
  };

  const activate = (event: MouseEvent<T>) => {
    if (suppress_click_ref.current) {
      suppress_click_ref.current = false;
      event.preventDefault();
      return;
    }
    on_activate?.(event);
  };

  const tilt = (event: MouseEvent<T>) => {
    if (drag_ref.current.pointer_id !== null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    event.currentTarget.style.setProperty('--cover-rotate-x', `${(y - 0.5) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-rotate-y', `${(0.5 - x) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-shine-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--cover-shine-y', `${y * 100}%`);
  };

  const reset_tilt = (event: MouseEvent<T>) => {
    if (drag_ref.current.pointer_id !== null) return;
    event.currentTarget.style.setProperty('--cover-rotate-x', '0deg');
    event.currentTarget.style.setProperty('--cover-rotate-y', '0deg');
    event.currentTarget.style.setProperty('--cover-shine-x', '50%');
    event.currentTarget.style.setProperty('--cover-shine-y', '18%');
  };

  useEffect(() => {
    return () => {
      const frame = motion_ref.current.frame;
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return {
    onClick: activate,
    onMouseMove: tilt,
    onMouseLeave: reset_tilt,
    onPointerDown: begin_drag,
    onPointerMove: deform,
    onPointerUp: end_drag,
    onPointerCancel: end_drag
  };
}
