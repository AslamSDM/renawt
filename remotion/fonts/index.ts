import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: bebasNeueFont } = loadBebasNeue("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const { fontFamily: montserratFont } = loadMontserrat("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export { bebasNeueFont, montserratFont };
export const HEADLINE_FONT = bebasNeueFont;
export const BODY_FONT = montserratFont;
