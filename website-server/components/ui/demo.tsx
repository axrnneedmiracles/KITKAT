import { GradientBackground } from "@/components/ui/noisy-gradient-backgrounds";

const DemoOne = () => {
  const demoDivClasses = "h-screen w-full relative rounded-2xl border border-white/20 overflow-hidden";
  const demoDivGapClass = "mb-2"; 

  return (
    <div className="w-full p-2"> {/* Outermost wrapper with padding */}

      {/* 1. "Sunset Glow" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="bottom-middle"
          noiseIntensity={1.0}
          noisePatternSize={90}
          noisePatternRefreshInterval={2}
        />
      </div>

      {/* 2. "Oceanic Depth" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="top-left"
          colors={[
            { color: "rgba(0,20,30,1)", stop: "0%" },
            { color: "rgba(0,51,78,1)", stop: "20%" },
            { color: "rgba(0,119,182,1)", stop: "50%" },
            { color: "rgba(3,169,244,1)", stop: "75%" },
            { color: "rgba(173,216,230,1)", stop: "100%" }
          ]}
          noiseIntensity={0.8}
          noisePatternSize={100}
          noisePatternRefreshInterval={1}
        />
      </div>

      {/* 3. "Forest Canopy" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="right-middle"
          colors={[
            { color: "rgba(10,38,10,1)", stop: "0%" },
            { color: "rgba(0,77,64,1)", stop: "25%" },
            { color: "rgba(46,125,50,1)", stop: "50%" },
            { color: "rgba(129,199,132,1)", stop: "75%" },
            { color: "rgba(200,230,201,1)", stop: "100%" }
          ]}
          noiseIntensity={1.2}
          noisePatternSize={80}
          noisePatternRefreshInterval={2}
        />
      </div>

      {/* 4. "Cosmic Nebula" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="center"
          colors={[
            { color: "rgba(26,20,50,1)", stop: "0%" },
            { color: "rgba(76,17,88,1)", stop: "25%" },
            { color: "rgba(142,68,173,1)", stop: "50%" },
            { color: "rgba(233,30,99,1)", stop: "75%" },
            { color: "rgba(255,110,199,1)", stop: "100%" }
          ]}
          gradientSize="150% 150%"
          noiseIntensity={0.7}
          noisePatternSize={110}
          noisePatternRefreshInterval={1}
        />
      </div>

      {/* 5. "Desert Dawn" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="bottom-right"
          colors={[
            { color: "rgba(120,40,40,1)", stop: "0%" },
            { color: "rgba(188,71,73,1)", stop: "30%" },
            { color: "rgba(244,143,177,1)", stop: "60%" },
            { color: "rgba(252,207,178,1)", stop: "85%" },
            { color: "rgba(255,235,215,1)", stop: "100%" }
          ]}
          noiseIntensity={1.1}
          noisePatternSize={95}
          noisePatternRefreshInterval={2}
        />
      </div>

      {/* 6. "Fiery Embers" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="left-middle"
          colors={[
            { color: "rgba(50,0,0,1)", stop: "0%" },
            { color: "rgba(183,28,28,1)", stop: "30%" },
            { color: "rgba(244,67,54,1)", stop: "60%" },
            { color: "rgba(255,152,0,1)", stop: "85%" },
            { color: "rgba(255,235,59,1)", stop: "100%" }
          ]}
          noiseIntensity={1.5}
          noisePatternSize={70}
          noisePatternRefreshInterval={1}
        />
      </div>

      {/* 7. "Lavender Dreams" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="top-right"
          colors={[
            { color: "rgba(49,27,69,1)", stop: "0%" },
            { color: "rgba(94,53,177,1)", stop: "30%" },
            { color: "rgba(179,157,219,1)", stop: "60%" },
            { color: "rgba(237,231,246,1)", stop: "85%" },
            { color: "rgba(250,250,250,1)", stop: "100%" }
          ]}
          noiseIntensity={0.9}
          noisePatternSize={120}
          noisePatternRefreshInterval={2}
        />
      </div>

      {/* 8. "Arctic Haze" */}
      <div className={`${demoDivClasses} ${demoDivGapClass}`}>
        <GradientBackground
          gradientOrigin="top-middle"
          colors={[
            { color: "rgba(38,50,56,1)", stop: "0%" },
            { color: "rgba(84,110,122,1)", stop: "30%" },
            { color: "rgba(176,190,197,1)", stop: "60%" },
            { color: "rgba(236,239,241,1)", stop: "85%" },
            { color: "rgba(255,255,255,1)", stop: "100%" }
          ]}
          noiseIntensity={1.3}
          noisePatternSize={100}
          noisePatternRefreshInterval={1}
        />
      </div>

      {/* 9. "Retro Wave" - Last one, no bottom margin */}
      <div className={`${demoDivClasses}`}> {/* Note: No demoDivGapClass here */}
        <GradientBackground
          gradientOrigin="bottom-left"
          colors={[
            { color: "rgba(255,0,150,1)", stop: "0%" },
            { color: "rgba(200,0,200,1)", stop: "30%" },
            { color: "rgba(0,150,255,1)", stop: "60%" },
            { color: "rgba(0,200,200,1)", stop: "85%" },
            { color: "rgba(255,255,100,1)", stop: "100%" }
          ]}
          noiseIntensity={0.6}
          noisePatternSize={130}
          noisePatternRefreshInterval={2}
        />
      </div>
    </div>
  );
};

export { DemoOne };
