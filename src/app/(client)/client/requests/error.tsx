"use client";
import { ErrorBlock } from "@/components/shared/ErrorBlock";
export default function Error(props: Parameters<typeof ErrorBlock>[0]) {
  return <ErrorBlock {...props} />;
}
