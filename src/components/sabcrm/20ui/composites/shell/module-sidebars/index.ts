"use client";

/**
 * Aggregates the per-module sidebar configs in this folder into one
 * array that ../app-sidebars.tsx spreads into `SAB_APP_SIDEBARS`
 * AHEAD of the `/dashboard` catch-all (order matters — deeper
 * prefixes must match first).
 *
 * Adding a module: create `<module>.tsx` exporting a
 * `SabAppSidebarConfig` built with `leaf()` from `./_shared`, then
 * list it here.
 */

import type { SabAppSidebarConfig } from "./_shared";

import { API_SIDEBAR } from "./api";
import { SABBI_SIDEBAR } from "./sabbi";
import { SABBIGIN_SIDEBAR } from "./sabbigin";
import { SABBUGS_SIDEBAR } from "./sabbugs";
import { SABCAMPAIGNS_SIDEBAR } from "./sabcampaigns";
import { SABCATALYST_SIDEBAR } from "./sabcatalyst";
import { SABCHECKOUT_SIDEBAR } from "./sabcheckout";
import { SABCONNECT_SIDEBAR } from "./sabconnect";
import { SABCREATOR_SIDEBAR } from "./sabcreator";
import { SABDESK_SIDEBAR } from "./sabdesk";
import { SABLENS_SIDEBAR } from "./sablens";
import { SABMAIL_SIDEBAR } from "./sabmail";
import { SABMEET_SIDEBAR } from "./sabmeet";
import { SABMONITOR_SIDEBAR } from "./sabmonitor";
import { SABOPS_SIDEBAR } from "./sabops";
import { SABPRACTICE_SIDEBAR } from "./sabpractice";
import { SABPREP_SIDEBAR } from "./sabprep";
import { SABPUBLISH_SIDEBAR } from "./sabpublish";
import { SABREQUESTS_SIDEBAR } from "./sabrequests";
import { SABREWARDS_SIDEBAR } from "./sabrewards";
import { SABSENSE_SIDEBAR } from "./sabsense";
import { SABSHEET_SIDEBAR } from "./sabsheet";
import { SABSHOP_SIDEBAR } from "./sabshop";
import { SABSHOW_SIDEBAR } from "./sabshow";
import { SABSIGN_SIDEBAR } from "./sabsign";
import { SABSPRINTS_SIDEBAR } from "./sabsprints";
import { SABTABLES_SIDEBAR } from "./sabtables";
import { SABTHRIVE_SIDEBAR } from "./sabthrive";
import { SABVAULT_SIDEBAR } from "./sabvault";
import { SABVOICE_SIDEBAR } from "./sabvoice";
import { SABWEBINAR_SIDEBAR } from "./sabwebinar";
import { SABWORKERLY_SIDEBAR } from "./sabworkerly";

export type { SabAppSidebarConfig } from "./_shared";
export { leaf } from "./_shared";

export const MODULE_SIDEBARS: SabAppSidebarConfig[] = [
  API_SIDEBAR,
  SABBI_SIDEBAR,
  SABBIGIN_SIDEBAR,
  SABBUGS_SIDEBAR,
  SABCAMPAIGNS_SIDEBAR,
  SABCATALYST_SIDEBAR,
  SABCHECKOUT_SIDEBAR,
  SABCONNECT_SIDEBAR,
  SABCREATOR_SIDEBAR,
  SABDESK_SIDEBAR,
  SABLENS_SIDEBAR,
  SABMAIL_SIDEBAR,
  SABMEET_SIDEBAR,
  SABMONITOR_SIDEBAR,
  SABOPS_SIDEBAR,
  SABPRACTICE_SIDEBAR,
  SABPREP_SIDEBAR,
  SABPUBLISH_SIDEBAR,
  SABREQUESTS_SIDEBAR,
  SABREWARDS_SIDEBAR,
  SABSENSE_SIDEBAR,
  SABSHEET_SIDEBAR,
  SABSHOP_SIDEBAR,
  SABSHOW_SIDEBAR,
  SABSIGN_SIDEBAR,
  SABSPRINTS_SIDEBAR,
  SABTABLES_SIDEBAR,
  SABTHRIVE_SIDEBAR,
  SABVAULT_SIDEBAR,
  SABVOICE_SIDEBAR,
  SABWEBINAR_SIDEBAR,
  SABWORKERLY_SIDEBAR,
];
