import { Composition } from "remotion";
import { KinnDemo, FPS, DURATION_SECONDS } from "./KinnDemo";
import {
  Act2Pipeline,
  PIPELINE_FPS,
  PIPELINE_DURATION_FRAMES,
} from "./acts/Act2Pipeline";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="KinnDemo"
        component={KinnDemo}
        durationInFrames={FPS * DURATION_SECONDS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="KinnPipeline"
        component={Act2Pipeline}
        durationInFrames={PIPELINE_DURATION_FRAMES}
        fps={PIPELINE_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
