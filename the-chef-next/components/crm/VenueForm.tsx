import { saveVenue } from "@/app/crm/actions";
import type { Venue } from "@/lib/crm/domain";

export function VenueForm({ venue }: { venue?: Partial<Venue> }) {
  return (
    <form action={saveVenue}>
      <input type="hidden" name="id" value={venue?.id ?? ""} />
      <div className="crm-form-grid">
        <label>
          Venue name
          <input name="name" defaultValue={venue?.name ?? ""} required />
        </label>
        <label>
          Address
          <input name="address" defaultValue={venue?.address ?? ""} />
        </label>
        <label>
          City
          <input name="city" defaultValue={venue?.city ?? ""} />
        </label>
        <label>
          State
          <input name="state" defaultValue={venue?.state ?? ""} />
        </label>
        <label>
          ZIP
          <input name="postal_code" defaultValue={venue?.postal_code ?? ""} />
        </label>
        <label>
          Contact person
          <input name="contact_name" defaultValue={venue?.contact_name ?? ""} />
        </label>
        <label>
          Contact email
          <input
            type="email"
            name="contact_email"
            defaultValue={venue?.contact_email ?? ""}
          />
        </label>
        <label>
          Contact phone
          <input name="contact_phone" defaultValue={venue?.contact_phone ?? ""} />
        </label>
        <label>
          Kitchen availability
          <select
            name="kitchen_availability"
            defaultValue={venue?.kitchen_availability ?? "unknown"}
          >
            {["unknown", "none", "limited", "full", "commercial"].map((value) => (
              <option value={value} key={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          COI requirement
          <select
            name="coi_requirement"
            defaultValue={venue?.coi_requirement ?? "unknown"}
          >
            <option value="unknown">Unknown</option>
            <option value="not_required">Not required</option>
            <option value="required">Required</option>
          </select>
        </label>
        <label>
          Insurance due days before event
          <input
            type="number"
            min="0"
            max="365"
            name="insurance_due_days_before_event"
            defaultValue={venue?.insurance_due_days_before_event ?? ""}
          />
        </label>
      </div>
      <label>
        Loading instructions
        <textarea
          name="loading_instructions"
          defaultValue={venue?.loading_instructions ?? ""}
        />
      </label>
      <label>
        Parking / loading notes
        <textarea
          name="parking_loading_notes"
          defaultValue={venue?.parking_loading_notes ?? ""}
        />
      </label>
      <label>
        Setup restrictions
        <textarea
          name="setup_restrictions"
          defaultValue={venue?.setup_restrictions ?? ""}
        />
      </label>
      <label>
        Additional insured requirements
        <textarea
          name="additional_insured_requirements"
          defaultValue={venue?.additional_insured_requirements ?? ""}
        />
      </label>
      <label>
        Insurance notes
        <textarea
          name="insurance_notes"
          defaultValue={venue?.insurance_notes ?? ""}
        />
      </label>
      <label>
        Venue notes
        <textarea name="notes" defaultValue={venue?.notes ?? ""} />
      </label>
      <button>{venue?.id ? "Save venue" : "Create venue"}</button>
    </form>
  );
}
