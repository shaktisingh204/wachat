import { FormSkeleton } from "@/components/sabsms/motion/skeletons";

export default function Loading() {
  return (
    <div className="p-6">
      <FormSkeleton fields={6} />
    </div>
  );
}
