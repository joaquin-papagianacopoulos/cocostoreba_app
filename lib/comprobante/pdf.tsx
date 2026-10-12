import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ComprobanteData } from "@/lib/comprobante/data";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  negocio: { flexDirection: "row", gap: 10, maxWidth: "60%" },
  logo: { width: 56, height: 56, objectFit: "contain" },
  nombre: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#555" },
  box: { borderWidth: 1, borderColor: "#999", padding: 8, alignItems: "flex-end", minWidth: 170 },
  titulo: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  numero: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  leyendaTop: { fontSize: 7, color: "#555", marginTop: 4 },
  section: { marginBottom: 12 },
  label: { fontFamily: "Helvetica-Bold" },
  table: { borderTopWidth: 1, borderColor: "#999" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ccc", paddingVertical: 4 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#999", paddingVertical: 4, backgroundColor: "#f2f2f2" },
  cCant: { width: "8%", textAlign: "right", paddingRight: 6 },
  cDesc: { width: "44%", paddingLeft: 4 },
  cPrecio: { width: "16%", textAlign: "right" },
  cDescuento: { width: "16%", textAlign: "right" },
  cSub: { width: "16%", textAlign: "right", paddingRight: 4 },
  totales: { marginTop: 10, marginLeft: "auto", width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#111", paddingTop: 4, marginTop: 2, fontSize: 12, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 30, left: 36, right: 36, textAlign: "center", fontSize: 8, color: "#555" },
  leyenda: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#111", marginBottom: 3 },
  anulado: { position: "absolute", top: 300, left: 90, fontSize: 80, color: "#d00", opacity: 0.18, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
});

function ComprobanteDoc({ data, logo }: { data: ComprobanteData; logo: string | null }) {
  const n = data.negocio;
  return (
    <Document title={`${data.titulo}${data.numero ? ` ${data.numero}` : ""}`} author={n.nombre}>
      <Page size="A4" style={s.page}>
        {data.anulado && <Text style={s.anulado}>ANULADO</Text>}

        <View style={s.header}>
          <View style={s.negocio}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no tiene alt */}
            {logo && <Image src={logo} style={s.logo} />}
            <View>
              <Text style={s.nombre}>{n.nombre}</Text>
              {n.cuit && <Text style={s.muted}>CUIT {n.cuit}</Text>}
              {n.direccion && <Text style={s.muted}>{n.direccion}</Text>}
              {n.telefono && <Text style={s.muted}>Tel. {n.telefono}</Text>}
            </View>
          </View>
          <View style={s.box}>
            <Text style={s.titulo}>{data.titulo}</Text>
            {data.numero && <Text style={s.numero}>N° {data.numero}</Text>}
            <Text>Fecha: {data.fecha}</Text>
            <Text style={s.leyendaTop}>{data.leyenda}</Text>
          </View>
        </View>

        {data.cliente && (
          <View style={s.section}>
            <Text>
              <Text style={s.label}>Cliente: </Text>
              {data.cliente.nombre}
              {data.cliente.cuit ? ` · CUIT ${data.cliente.cuit}` : ""}
            </Text>
            {data.cliente.direccion && <Text style={s.muted}>{data.cliente.direccion}</Text>}
            {data.cliente.telefono && <Text style={s.muted}>Tel. {data.cliente.telefono}</Text>}
          </View>
        )}

        <View style={s.table}>
          <View style={s.headRow} fixed>
            <Text style={s.cCant}>Cant.</Text>
            <Text style={s.cDesc}>Descripción</Text>
            <Text style={s.cPrecio}>P. unitario</Text>
            <Text style={s.cDescuento}>Descuento</Text>
            <Text style={s.cSub}>Subtotal</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.cCant}>{item.cantidad}</Text>
              <Text style={s.cDesc}>{item.descripcion}</Text>
              <Text style={s.cPrecio}>{item.precioUnitario}</Text>
              <Text style={s.cDescuento}>{item.descuento}</Text>
              <Text style={s.cSub}>{item.subtotal}</Text>
            </View>
          ))}
        </View>

        <View style={s.totales}>
          <View style={s.totalRow}>
            <Text>Importe</Text>
            <Text>{data.importeBruto}</Text>
          </View>
          {data.descuentoItems && (
            <View style={s.totalRow}>
              <Text>Descuentos por promociones</Text>
              <Text>{data.descuentoItems}</Text>
            </View>
          )}
          {data.descuentoGeneral && (
            <View style={s.totalRow}>
              <Text>Descuento general</Text>
              <Text>{data.descuentoGeneral}</Text>
            </View>
          )}
          <View style={s.totalFinal}>
            <Text>Total</Text>
            <Text>{data.total}</Text>
          </View>
          {data.medioPago && (
            <View style={s.totalRow}>
              <Text style={s.muted}>Medio de pago</Text>
              <Text style={s.muted}>{data.medioPago}</Text>
            </View>
          )}
          {data.cotizacion && (
            <View style={s.totalRow}>
              <Text style={s.muted}>Cotización usada</Text>
              <Text style={s.muted}>{data.cotizacion}</Text>
            </View>
          )}
        </View>

        {data.notas && (
          <View style={[s.section, { marginTop: 16 }]}>
            <Text style={s.label}>Notas</Text>
            <Text>{data.notas}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.leyenda}>{data.leyenda}</Text>
          {data.pie && <Text>{data.pie}</Text>}
        </View>
      </Page>
    </Document>
  );
}

/** PDF A4 del comprobante. `logo` es un data URI (png/jpeg) o null. */
export function renderComprobantePdf(data: ComprobanteData, logo: string | null): Promise<Buffer> {
  return renderToBuffer(<ComprobanteDoc data={data} logo={logo} />);
}
