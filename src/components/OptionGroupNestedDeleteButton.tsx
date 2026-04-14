"use client";

/** Nested submit that posts to a different URL than the parent form (HTML formaction). Must be a Client Component so React/Next does not attach non-serializable handlers from a Server parent. */
export default function OptionGroupNestedDeleteButton({
  groupId,
  tenantSlug,
}: {
  groupId: number;
  tenantSlug: string;
}) {
  return (
    <button
      type="submit"
      className="btn btn--danger option-group-edit-btn"
      formMethod="post"
      formAction={`/api/admin/option-groups/${groupId}/delete`}
      name="tenantSlug"
      value={tenantSlug}
    >
      삭제
    </button>
  );
}
