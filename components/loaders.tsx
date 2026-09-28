/**
 * Loading + waiting spinners (user-provided SVGs, recolored to currentColor).
 * Spinner is the default loader everywhere; the rest are waiting states.
 */

type LoaderProps = { className?: string };

/** Primary line spinner — the normal loading indicator. */
export function Spinner({ className = "size-5" }: LoaderProps) {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      x="0px"
      y="0px"
      viewBox="0 0 2400 2400"
      className={className}
      role="status"
      aria-label="Loading"
    >
      <g strokeWidth="200" strokeLinecap="round" stroke="currentColor" fill="none" id="spinner">
        <line x1="1200" y1="600" x2="1200" y2="100" />
        <line opacity="0.5" x1="1200" y1="2300" x2="1200" y2="1800" />
        <line opacity="0.917" x1="900" y1="680.4" x2="650" y2="247.4" />
        <line opacity="0.417" x1="1750" y1="2152.6" x2="1500" y2="1719.6" />
        <line opacity="0.833" x1="680.4" y1="900" x2="247.4" y2="650" />
        <line opacity="0.333" x1="2152.6" y1="1750" x2="1719.6" y2="1500" />
        <line opacity="0.75" x1="600" y1="1200" x2="100" y2="1200" />
        <line opacity="0.25" x1="2300" y1="1200" x2="1800" y2="1200" />
        <line opacity="0.667" x1="680.4" y1="1500" x2="247.4" y2="1750" />
        <line opacity="0.167" x1="2152.6" y1="650" x2="1719.6" y2="900" />
        <line opacity="0.583" x1="900" y1="1719.6" x2="650" y2="2152.6" />
        <line opacity="0.083" x1="1750" y1="247.4" x2="1500" y2="680.4" />
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          keyTimes="0;0.08333;0.16667;0.25;0.33333;0.41667;0.5;0.58333;0.66667;0.75;0.83333;0.91667"
          values="0 1199 1199;30 1199 1199;60 1199 1199;90 1199 1199;120 1199 1199;150 1199 1199;180 1199 1199;210 1199 1199;240 1199 1199;270 1199 1199;300 1199 1199;330 1199 1199"
          dur="0.83333s"
          begin="0s"
          repeatCount="indefinite"
          calcMode="discrete"
        />
      </g>
    </svg>
  );
}

/** Flipping square — waiting state. */
export function SquareLoader({ className = "size-5" }: LoaderProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} role="status" aria-label="Loading">
      <style>{`#dtp-rect1662{animation:dtp-square-spin 3s 0s cubic-bezier(.09,.57,.49,.9) infinite;transform-origin:50% 50%}@keyframes dtp-square-spin{25%{transform:rotateX(180deg) rotateY(0)}50%{transform:rotateX(180deg) rotateY(180deg)}75%{transform:rotateX(0) rotateY(180deg)}100%{transform:rotateX(0) rotateY(0)}}`}</style>
      <rect width="20" height="20" fill="currentColor" id="dtp-rect1662" />
    </svg>
  );
}

/** Rotating box draining — waiting state. */
export function BoxLoader({ className = "size-6" }: LoaderProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="status" aria-label="Loading">
      <rect fill="none" stroke="currentColor" strokeWidth="4" x="25" y="25" width="50" height="50">
        <animateTransform
          attributeName="transform"
          dur="0.5s"
          from="0 50 50"
          to="180 50 50"
          type="rotate"
          id="dtp-strokeBox"
          attributeType="XML"
          begin="dtp-rectBox.end"
        />
      </rect>
      <rect x="27" y="27" fill="currentColor" width="46" height="50">
        <animate
          attributeName="height"
          dur="1.3s"
          attributeType="XML"
          from="50"
          to="0"
          id="dtp-rectBox"
          fill="freeze"
          begin="0s;dtp-strokeBox.end"
        />
      </rect>
    </svg>
  );
}

/** Pulsing dot grid — "finding a driver" style waiting states. */
export function DotsPulse({ className = "size-8" }: LoaderProps) {
  const dots = [
    [12.5, 12.5, "0s", 1], [12.5, 52.5, "100ms", 0.5], [52.5, 12.5, "300ms", 1],
    [52.5, 52.5, "600ms", 1], [92.5, 12.5, "800ms", 1], [92.5, 52.5, "400ms", 1],
    [12.5, 92.5, "700ms", 1], [52.5, 92.5, "500ms", 1], [92.5, 92.5, "200ms", 1],
  ] as const;
  return (
    <svg viewBox="0 0 105 105" className={className} fill="currentColor" role="status" aria-label="Loading">
      {dots.map(([cx, cy, begin, opacity], i) => (
        <circle key={i} cx={cx} cy={cy} r="12.5" fillOpacity={opacity}>
          <animate
            attributeName="fill-opacity"
            begin={begin}
            dur="1s"
            values="1;.2;1"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

/** Gooey bouncing balls — waiting state. */
export function GooeyBalls({ className = "size-6" }: LoaderProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="status" aria-label="Loading">
      <defs>
        <filter id="dtp-gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="y" />
          <feColorMatrix in="y" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -7" result="z" />
          <feBlend in="SourceGraphic" in2="z" />
        </filter>
      </defs>
      <g filter="url(#dtp-gooey)">
        <circle cx="5" cy="12" r="4">
          <animate
            attributeName="cx"
            calcMode="spline"
            dur="2s"
            values="5;8;5"
            keySplines=".36,.62,.43,.99;.79,0,.58,.57"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="19" cy="12" r="4">
          <animate
            attributeName="cx"
            calcMode="spline"
            dur="2s"
            values="19;16;19"
            keySplines=".36,.62,.43,.99;.79,0,.58,.57"
            repeatCount="indefinite"
          />
        </circle>
        <animateTransform
          attributeName="transform"
          type="rotate"
          dur="0.75s"
          values="0 12 12;360 12 12"
          repeatCount="indefinite"
        />
      </g>
    </svg>
  );
}

/** Rotating pulsing ring — waiting state. */
export function PulseRing({ className = "size-6" }: LoaderProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="status" aria-label="Loading">
      <g>
        <circle cx="12" cy="3" r="1"><animate id="dtp-ring-7Z73" begin="0;dtp-ring-tKsu.end-0.5s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="16.50" cy="4.21" r="1"><animate id="dtp-ring-Wd87" begin="dtp-ring-7Z73.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="7.50" cy="4.21" r="1"><animate id="dtp-ring-tKsu" begin="dtp-ring-9Qlc.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="19.79" cy="7.50" r="1"><animate id="dtp-ring-lMMO" begin="dtp-ring-Wd87.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="4.21" cy="7.50" r="1"><animate id="dtp-ring-9Qlc" begin="dtp-ring-Khxv.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="21.00" cy="12.00" r="1"><animate id="dtp-ring-5L9t" begin="dtp-ring-lMMO.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="3.00" cy="12.00" r="1"><animate id="dtp-ring-Khxv" begin="dtp-ring-ld6P.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="19.79" cy="16.50" r="1"><animate id="dtp-ring-BfTD" begin="dtp-ring-5L9t.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="4.21" cy="16.50" r="1"><animate id="dtp-ring-ld6P" begin="dtp-ring-XyBs.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="16.50" cy="19.79" r="1"><animate id="dtp-ring-7gAK" begin="dtp-ring-BfTD.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="7.50" cy="19.79" r="1"><animate id="dtp-ring-XyBs" begin="dtp-ring-HiSl.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <circle cx="12" cy="21" r="1"><animate id="dtp-ring-HiSl" begin="dtp-ring-7gAK.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73" /></circle>
        <animateTransform attributeName="transform" type="rotate" dur="6s" values="360 12 12;0 12 12" repeatCount="indefinite" />
      </g>
    </svg>
  );
}

/** Three dots traveling — waiting state. */
export function TravelDots({ className = "size-6" }: LoaderProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="status" aria-label="Loading">
      <circle cx="4" cy="12" r="0">
        <animate begin="0;dtp-t-z0or.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="0;3" fill="freeze" />
        <animate begin="dtp-t-olms.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="4;12" fill="freeze" />
        <animate begin="dtp-t-uhr2.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="12;20" fill="freeze" />
        <animate id="dtp-t-lo66" begin="dtp-t-aguh.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="3;0" fill="freeze" />
        <animate id="dtp-t-z0or" begin="dtp-t-lo66.end" attributeName="cx" dur="0.001s" values="20;4" fill="freeze" />
      </circle>
      <circle cx="4" cy="12" r="3">
        <animate begin="0;dtp-t-z0or.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="4;12" fill="freeze" />
        <animate begin="dtp-t-olms.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="12;20" fill="freeze" />
        <animate id="dtp-t-jsnr" begin="dtp-t-uhr2.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="3;0" fill="freeze" />
        <animate id="dtp-t-aguh" begin="dtp-t-jsnr.end" attributeName="cx" dur="0.001s" values="20;4" fill="freeze" />
        <animate begin="dtp-t-aguh.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="0;3" fill="freeze" />
      </circle>
      <circle cx="12" cy="12" r="3">
        <animate begin="0;dtp-t-z0or.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="12;20" fill="freeze" />
        <animate id="dtp-t-hsjk" begin="dtp-t-olms.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="3;0" fill="freeze" />
        <animate id="dtp-t-uhr2" begin="dtp-t-hsjk.end" attributeName="cx" dur="0.001s" values="20;4" fill="freeze" />
        <animate begin="dtp-t-uhr2.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="0;3" fill="freeze" />
        <animate begin="dtp-t-aguh.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="4;12" fill="freeze" />
      </circle>
      <circle cx="20" cy="12" r="3">
        <animate id="dtp-t-4v5m" begin="0;dtp-t-z0or.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="3;0" fill="freeze" />
        <animate id="dtp-t-olms" begin="dtp-t-4v5m.end" attributeName="cx" dur="0.001s" values="20;4" fill="freeze" />
        <animate begin="dtp-t-olms.end" attributeName="r" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="3;0" fill="freeze" />
        <animate begin="dtp-t-uhr2.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="12;20" fill="freeze" />
        <animate begin="dtp-t-aguh.end" attributeName="cx" calcMode="spline" dur="0.5s" keySplines=".36,.6,.31,1" values="4;12" fill="freeze" />
      </circle>
    </svg>
  );
}
