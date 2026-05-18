// Type shapes for Meta Pixel + Conversions API events.
//
// Only the standard events we actually fire today are modelled.
// Adding a new event = add it to MetaEventName + give it a row in
// the MetaCustomData union below.

export type MetaEventName =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase";

// Browser-side payload. `_fbp` / `_fbc` are auto-attached by the Pixel
// SDK; `external_id` is the only thing we manually pass from client.
export type MetaCustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  content_category?: string;
  num_items?: number;
};

// Server-side user_data fields. Everything sensitive (em/ph/fn/ln) is
// SHA-256 hex hashed by `lib/meta/hash.ts` before reaching here.
export type MetaUserData = {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  external_id?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
};

export type CapiEventInput = {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl?: string;
  userData: MetaUserData;
  customData?: MetaCustomData;
  // Unix seconds; defaults to now() when omitted.
  eventTime?: number;
};
