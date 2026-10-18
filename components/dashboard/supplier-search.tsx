"use client"

import { useMemo } from "react"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"
import type { Supplier } from "@/lib/supplier-data"

export function SupplierSearch({
  suppliers,
  value,
  onChange,
  onPick,
  label,
}: {
  suppliers: Supplier[]
  value: string
  onChange: (value: string) => void
  onPick?: (supplier: Supplier) => void
  label: string
}) {
  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase()
    return suppliers
      .filter(
        (s) => !query || `${s.id} ${s.name}`.toLowerCase().includes(query)
      )
      .slice(0, 8)
  }, [suppliers, value])
  return (
    <Combobox
      items={suggestions}
      filter={null}
      itemToStringLabel={(s: Supplier) => s.id}
      inputValue={value}
      onInputValueChange={(nextValue, details) => {
        if (details.reason === "input-change") onChange(nextValue)
      }}
      onValueChange={(supplier) => {
        if (supplier) {
          onChange(supplier.id)
          onPick?.(supplier)
        }
      }}
    >
      <ComboboxInput
        aria-label={label}
        showTrigger={false}
        placeholder="Search name or supplier ID…"
        className="h-10 w-full min-w-48 text-base md:text-sm"
      />
      <ComboboxContent>
        <ComboboxEmpty className="p-4">No matching suppliers.</ComboboxEmpty>
        <ComboboxList>
          {(supplier: Supplier) => (
            <ComboboxItem
              key={supplier.id}
              value={supplier}
              className="min-h-11"
            >
              <div className="min-w-0">
                <p className="truncate">{supplier.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {supplier.id} · Risk {supplier.risk}
                </p>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
