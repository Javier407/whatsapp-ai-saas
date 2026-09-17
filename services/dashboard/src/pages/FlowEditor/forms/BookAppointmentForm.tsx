import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfigForm, type ConfigFormProps } from "./shared";

export function BookAppointmentForm({ data, onChange }: ConfigFormProps) {
  const { register } = useConfigForm(
    {
      customer_name_slot: (data.config.customer_name_slot as string) ?? "customer_name",
      service_slot: (data.config.service_slot as string) ?? "service",
      date_slot: (data.config.date_slot as string) ?? "appointment_date",
      confirmation: (data.config.confirmation as string) ?? "",
    },
    onChange,
  );
  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="customer_name_slot">Slot con el nombre del cliente</Label>
        <Input id="customer_name_slot" {...register("customer_name_slot")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service_slot">Slot con el servicio</Label>
        <Input id="service_slot" {...register("service_slot")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date_slot">Slot con la fecha pedida</Label>
        <Input id="date_slot" {...register("date_slot")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmation">Mensaje de confirmación (opcional)</Label>
        <Textarea id="confirmation" rows={2} {...register("confirmation")} />
      </div>
    </form>
  );
}
