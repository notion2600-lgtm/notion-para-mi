import { isImageIcon } from "@/components/workspace/icon-picker";

export function PageIcon({
  className = "size-4",
  fallback = "📄",
  icon,
}: {
  className?: string;
  fallback?: string;
  icon?: string | null;
}) {
  if (isImageIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className={`inline-block shrink-0 rounded object-cover align-middle ${className}`} src={icon} />
    );
  }
  return <>{icon || fallback}</>;
}
