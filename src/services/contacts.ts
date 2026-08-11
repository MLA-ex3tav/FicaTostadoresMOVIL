import { Contacts } from "@capacitor-community/contacts";

export interface ContactEntry {
  id: string;
  name: string;
  phones: string[];
}

/** Pide permiso y devuelve los contactos con teléfono. */
export async function getPhoneContacts(): Promise<ContactEntry[]> {
  let status = (await Contacts.checkPermissions()).contacts;

  if (status === "prompt" || status === "prompt-with-rationale") {
    status = (await Contacts.requestPermissions()).contacts;
  }

  if (status !== "granted" && status !== "limited") {
    throw new Error("Sin permiso para acceder a los contactos.");
  }

  const result = await Contacts.getContacts({
    projection: { name: true, phones: true },
  });

  return result.contacts
    .map((contact) => ({
      id: contact.contactId,
      name: contact.name?.display ?? "Sin nombre",
      phones: (contact.phones ?? [])
        .map((phone) => (phone.number ?? "").trim())
        .filter(Boolean),
    }))
    .filter((contact) => contact.phones.length > 0);
}
