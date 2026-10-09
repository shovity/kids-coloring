import { ui } from "@/lib/manifest";

const CLOUDS = [
  { src: "cloud-1.png", top: "6%", width: 200, duration: 70, delay: -10 },
  { src: "cloud-3.png", top: "18%", width: 250, duration: 95, delay: -60 },
  { src: "cloud-2.png", top: "10%", width: 170, duration: 80, delay: -35 },
  { src: "cloud-2-back.png", top: "30%", width: 240, duration: 120, delay: -90 },
];

export default function Sky() {
  return (
    <div className="sky" aria-hidden>
      {CLOUDS.map((c) => (
        <img
          key={c.src}
          className="cloud"
          src={ui(c.src)}
          alt=""
          style={{ top: c.top, width: c.width, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
        />
      ))}
    </div>
  );
}
