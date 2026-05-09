import { Country } from "country-state-city";

export function getCountryOptions() {
  return Country.getAllCountries()
    .map((country) => ({
      name: country.name,
      isoCode: country.isoCode,
    }))
    .filter((country) => country.name && country.isoCode)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCountrySelectOptions() {
  return getCountryOptions().map((country) => ({
    value: country.name,
    label: country.name,
  }));
}

export function getCountryNames() {
  return getCountryOptions().map((country) => country.name);
}
