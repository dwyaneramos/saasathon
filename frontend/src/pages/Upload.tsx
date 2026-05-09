import { UploadWorkspace } from "@/components/upload-workspace";
import { useOutletContext } from "react-router-dom";

type OutletContext = { activeSpaceId: number | null };

export default function Upload() {
  const { activeSpaceId } = useOutletContext<OutletContext>();
  return <UploadWorkspace detailMode="full" showHeading spaceId={activeSpaceId} />;
}
