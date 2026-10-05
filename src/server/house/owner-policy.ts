/** Only a verified CMS identity matching the explicit configuration is the owner. */
export function isHouseOwner(configuredId: string | undefined, cmsUserId: string | undefined): boolean {
  return Boolean(configuredId && cmsUserId === configuredId);
}
