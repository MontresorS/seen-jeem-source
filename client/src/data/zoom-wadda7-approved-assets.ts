export type ApprovedZoomAsset = {
  category: "zoom";
  sourceImage: string;
  questionId: string;
  questionPrompt: string;
  answerOrDescription: string;
  pointTier: 200 | 400 | 600;
  image: string;
};

export type ApprovedWadda7Asset = {
  category: "wadda7";
  sourceImage: string;
  questionId: string;
  questionPrompt: string;
  answerOrDescription: string;
  pointTier: 200 | 400 | 600;
  stages: readonly [string, string, string];
};

export type ApprovedZoomWadda7Asset = ApprovedZoomAsset | ApprovedWadda7Asset;

export const APPROVED_ZOOM_WADDA7_ASSETS: Record<string, ApprovedZoomWadda7Asset> = {};

export function getApprovedZoomWadda7Asset(questionId: string): ApprovedZoomWadda7Asset | undefined {
  return APPROVED_ZOOM_WADDA7_ASSETS[questionId];
}
