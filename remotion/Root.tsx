import React from "react";
import { Composition } from "remotion";
import { DemoComposition } from "./compositions/DemoComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Demo"
        component={DemoComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
