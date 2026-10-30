-- FUNCTION: public.get_status_count(character varying, integer, integer, character varying, integer, character varying)

-- DROP FUNCTION IF EXISTS public.get_status_count(character varying, integer, integer, character varying, integer, character varying);

CREATE OR REPLACE FUNCTION public.get_status_count(
	p_access_level character varying,
	p_access_code integer,
	p_service_id integer,
	p_taken_by character varying,
	p_division_code integer,
	p_data_type character varying DEFAULT NULL::character varying)
    RETURNS TABLE(pendingcount integer, forwardedcount integer, returnedcount integer, returntoeditcount integer, sanctionedcount integer, rejectcount integer, disbursedcount integer, totalapplications integer, forwardedsanctionedcount integer, forwardedsanctionedcorrigendumcount integer, forwardedverifiedcorrectioncount integer, corrigendumpendingcount integer, corrigendumforwardedcount integer, corrigendumreturnedcount integer, corrigendumsanctionedcount integer, corrigendumrejectedcount integer, corrigendumcount integer, correctionpendingcount integer, correctionforwardedcount integer, correctionreturnedcount integer, correctionsanctionedcount integer, correctionrejectedcount integer, correctioncount integer, amendmentpendingcount integer, amendmentforwardedcount integer, amendmentreturnedcount integer, amendmentsanctionedcount integer, amendmentrejectedcount integer, amendmentcount integer, totalwithheldcount integer, temporarywithheldcount integer, permanentwithheldcount integer, withheldpendingcount integer, withheldforwardedcount integer, withheldapprovedcount integer) 
    LANGUAGE 'plpgsql'
    COST 100
    STABLE PARALLEL UNSAFE
    ROWS 1

AS $BODY$
DECLARE
    v_div_tehsils   integer[];
    v_div_districts integer[];
BEGIN
    IF p_access_level = 'Division' THEN
        SELECT ARRAY_AGG(DISTINCT t.tehsilid),
               ARRAY_AGG(DISTINCT d.districtid)
        INTO v_div_tehsils, v_div_districts
        FROM district d
        JOIN tehsil t ON t.districtid = d.districtid
        WHERE d.division = p_division_code;
        
        IF v_div_tehsils IS NULL THEN v_div_tehsils := ARRAY[]::integer[]; END IF;
        IF v_div_districts IS NULL THEN v_div_districts := ARRAY[]::integer[]; END IF;
    END IF;

    RETURN QUERY
    WITH 
    location_filter AS (
        SELECT 
            ca.latest_wf_status,
            ca.status,
            ca.latest_wf_designation
        FROM citizen_applications ca
        WHERE ca.serviceid = p_service_id
          AND ca.workflow IS NOT NULL
          AND (p_data_type IS NULL OR ca.datatype = p_data_type)
          AND ca.latest_wf_designation = p_taken_by
          AND (
               p_access_level = 'State'
               OR (p_access_level = 'Tehsil' AND (ca.formdetails_flat->>'Tehsil')::integer = p_access_code)
               OR (p_access_level = 'District' AND (ca.formdetails_flat->>'District')::integer = p_access_code)
               OR (p_access_level = 'Division' AND (
                    (ca.formdetails_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                    OR (ca.formdetails_flat->>'District')::integer = ANY(v_div_districts)
                  ))
              )
    ),
    returntoedit_rows AS (
        SELECT 
            ca.latest_wf_status,
            ca.status,
            ca.latest_wf_designation
        FROM citizen_applications ca
        WHERE ca.serviceid = p_service_id
          AND ca.workflow IS NOT NULL
          AND (p_data_type IS NULL OR ca.datatype = p_data_type)
          AND ca.latest_wf_status = 'returntoedit'
          AND (ca.latest_wf_designation IS NULL OR ca.latest_wf_designation <> p_taken_by)
          AND (
               p_access_level = 'State'
               OR (p_access_level = 'Tehsil' AND (ca.formdetails_flat->>'Tehsil')::integer = p_access_code)
               OR (p_access_level = 'District' AND (ca.formdetails_flat->>'District')::integer = p_access_code)
               OR (p_access_level = 'Division' AND (
                    (ca.formdetails_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                    OR (ca.formdetails_flat->>'District')::integer = ANY(v_div_districts)
                  ))
              )
    ),
    main_agg AS (
        SELECT
            COUNT(*) FILTER (WHERE latest_wf_status = 'pending')::INT AS pendingcount,
            COUNT(*) FILTER (WHERE latest_wf_status = 'forwarded')::INT AS forwardedcount,
            COUNT(*) FILTER (WHERE latest_wf_status = 'returned')::INT AS returnedcount,
            COUNT(*) FILTER (WHERE latest_wf_status = 'returntoedit')::INT AS returntoeditcount,
            COUNT(*) FILTER (WHERE latest_wf_status = 'sanctioned')::INT AS sanctionedcount,
            COUNT(*) FILTER (WHERE latest_wf_status = 'rejected')::INT AS rejectcount,
            COUNT(*) FILTER (WHERE latest_wf_status = 'disbursed')::INT AS disbursedcount,
            COUNT(*) FILTER (WHERE latest_wf_status <> 'returntoedit' 
                              OR (latest_wf_status = 'returntoedit' 
                                  AND latest_wf_designation = p_taken_by))::INT AS totalapplications,
            COUNT(*) FILTER (WHERE status = 'sanctioned' 
                             AND latest_wf_designation = p_taken_by 
                             AND latest_wf_status = 'forwarded')::INT AS forwardedsanctionedcount
        FROM (
            SELECT * FROM location_filter
            UNION ALL
            SELECT * FROM returntoedit_rows
        ) combined
    ),
    corr_agg AS (
        SELECT
            COUNT(*) FILTER (WHERE c.type IN ('Corrigendum','Amendment') AND c.status = 'sanctioned' AND c.latest_wf_status = 'forwarded')::INT AS fs_corr,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.status = 'verified' AND c.latest_wf_status = 'forwarded')::INT AS fs_verified,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'pending')::INT AS corr_pending,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'forwarded')::INT AS corr_forwarded,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'returned')::INT AS corr_returned,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'sanctioned')::INT AS corr_sanctioned,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'rejected')::INT AS corr_rejected,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum')::INT AS corr_total,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'pending')::INT AS cor_pending,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'forwarded')::INT AS cor_forwarded,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'returned')::INT AS cor_returned,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'verified')::INT AS cor_verified,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'rejected')::INT AS cor_rejected,
            COUNT(*) FILTER (WHERE c.type = 'Correction')::INT AS cor_total,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'pending')::INT AS amd_pending,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'forwarded')::INT AS amd_forwarded,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'returned')::INT AS amd_returned,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'sanctioned')::INT AS amd_sanctioned,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'rejected')::INT AS amd_rejected,
            COUNT(*) FILTER (WHERE c.type = 'Amendment')::INT AS amd_total
        FROM corrigendum c
        WHERE c.serviceid = p_service_id
          AND (p_data_type IS NULL OR c.datatype = p_data_type)
          AND (
              (c.datatype = 'legacy'
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (c.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (c.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (c.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (c.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
              OR
              (c.datatype <> 'legacy'
               AND c.latest_wf_designation = p_taken_by
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (c.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (c.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (c.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (c.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
          )
    ),
    wh_agg AS (
        SELECT
            COUNT(*) FILTER (WHERE w.iswithheld = true)::INT AS wh_total,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.withheldtype = 'TEMPORARY')::INT AS wh_temp,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.withheldtype = 'PERMANENT')::INT AS wh_perm,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.latest_wf_status = 'pending')::INT AS wh_pending,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.latest_wf_status = 'forwarded')::INT AS wh_forwarded,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.latest_wf_status = 'approved')::INT AS wh_approved
        FROM withheld_applications w
        WHERE w.serviceid = p_service_id
          AND w.workflow IS NOT NULL
          AND (p_data_type IS NULL OR w.datatype = p_data_type)
          AND (
              (w.datatype = 'legacy'
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (w.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (w.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (w.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (w.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
              OR
              (w.datatype <> 'legacy'
               AND (p_taken_by IS NULL OR w.latest_wf_designation = p_taken_by OR w.latest_wf_status = 'returntoedit')
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (w.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (w.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (w.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (w.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
          )
    )
    SELECT 
        m.pendingcount, m.forwardedcount, m.returnedcount, m.returntoeditcount,
        m.sanctionedcount, m.rejectcount, m.disbursedcount, m.totalapplications,
        m.forwardedsanctionedcount,
        COALESCE(c.fs_corr, 0), COALESCE(c.fs_verified, 0),
        COALESCE(c.corr_pending, 0), COALESCE(c.corr_forwarded, 0), COALESCE(c.corr_returned, 0),
        COALESCE(c.corr_sanctioned, 0), COALESCE(c.corr_rejected, 0), COALESCE(c.corr_total, 0),
        COALESCE(c.cor_pending, 0), COALESCE(c.cor_forwarded, 0), COALESCE(c.cor_returned, 0),
        COALESCE(c.cor_verified, 0), COALESCE(c.cor_rejected, 0), COALESCE(c.cor_total, 0),
        COALESCE(c.amd_pending, 0), COALESCE(c.amd_forwarded, 0), COALESCE(c.amd_returned, 0),
        COALESCE(c.amd_sanctioned, 0), COALESCE(c.amd_rejected, 0), COALESCE(c.amd_total, 0),
        COALESCE(w.wh_total, 0), COALESCE(w.wh_temp, 0), COALESCE(w.wh_perm, 0),
        COALESCE(w.wh_pending, 0), COALESCE(w.wh_forwarded, 0), COALESCE(w.wh_approved, 0)
    FROM main_agg m
    CROSS JOIN corr_agg c
    CROSS JOIN wh_agg w;
END;
$BODY$;

ALTER FUNCTION public.get_status_count(character varying, integer, integer, character varying, integer, character varying)
    OWNER TO postgres;

-- FUNCTION: public.get_dashboard_counts(character varying, integer, integer, character varying, integer, character varying)

-- DROP FUNCTION IF EXISTS public.get_dashboard_counts(character varying, integer, integer, character varying, integer, character varying);

CREATE OR REPLACE FUNCTION public.get_dashboard_counts(
	p_access_level character varying,
	p_access_code integer,
	p_service_id integer,
	p_taken_by character varying,
	p_division_code integer,
	p_data_type character varying DEFAULT NULL::character varying)
    RETURNS TABLE(pendingcount integer, forwardedcount integer, returnedcount integer, returntoeditcount integer, sanctionedcount integer, rejectcount integer, disbursedcount integer, totalapplications integer, forwardedsanctionedcount integer, forwardedsanctionedcorrigendumcount integer, forwardedverifiedcorrectioncount integer, corrigendumpendingcount integer, corrigendumforwardedcount integer, corrigendumreturnedcount integer, corrigendumsanctionedcount integer, corrigendumrejectedcount integer, corrigendumcount integer, correctionpendingcount integer, correctionforwardedcount integer, correctionreturnedcount integer, correctionsanctionedcount integer, correctionrejectedcount integer, correctioncount integer, amendmentpendingcount integer, amendmentforwardedcount integer, amendmentreturnedcount integer, amendmentsanctionedcount integer, amendmentrejectedcount integer, amendmentcount integer, totalwithheldcount integer, temporarywithheldcount integer, permanentwithheldcount integer, withheldpendingcount integer, withheldforwardedcount integer, withheldapprovedcount integer, shiftedcount bigint, temporarydisabilityexpiringsooncount bigint, totalphysicallychallengedapplications bigint, legacytotal integer, legacypending integer, legacyforwarded integer, legacysanctioned integer, legacyrejected integer) 
    LANGUAGE 'plpgsql'
    COST 100
    STABLE PARALLEL UNSAFE
    ROWS 1

AS $BODY$
DECLARE
    v_div_tehsils   integer[];
    v_div_districts integer[];
    v_taken_by_trimmed text := TRIM(p_taken_by);
    v_is_pcp_service boolean := (p_service_id = 1);
BEGIN
    IF p_access_level = 'Division' AND p_division_code IS NOT NULL THEN
        SELECT tehsil_ids, district_ids 
        INTO v_div_tehsils, v_div_districts
        FROM mv_division_locations 
        WHERE division = p_division_code;
        IF v_div_tehsils IS NULL THEN v_div_tehsils := ARRAY[]::integer[]; END IF;
        IF v_div_districts IS NULL THEN v_div_districts := ARRAY[]::integer[]; END IF;
    END IF;

    RETURN QUERY
    WITH 
    main_counts AS (
        SELECT 
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'pending')::INT AS pendingcount,
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'forwarded')::INT AS forwardedcount,
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'returned')::INT AS returnedcount,
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'returntoedit')::INT AS returntoedit_desig,
            COUNT(*) FILTER (WHERE latest_wf_status = 'returntoedit' AND (latest_wf_designation IS NULL OR latest_wf_designation <> v_taken_by_trimmed))::INT AS returntoedit_other,
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'sanctioned')::INT AS sanctionedcount,
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'rejected')::INT AS rejectcount,
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'disbursed')::INT AS disbursedcount,
            COUNT(*) FILTER (WHERE latest_wf_designation = v_taken_by_trimmed AND latest_wf_status <> 'returntoedit')::INT AS total_desig,
            COUNT(*) FILTER (WHERE status = 'sanctioned' AND latest_wf_designation = v_taken_by_trimmed AND latest_wf_status = 'forwarded')::INT AS forwardedsanctionedcount
        FROM citizen_applications ca
        WHERE ca.serviceid = p_service_id
          AND ca.workflow IS NOT NULL
          AND (p_data_type IS NULL OR ca.datatype = p_data_type)
          AND (
               p_access_level = 'State'
               OR (p_access_level = 'Tehsil' AND (ca.formdetails_flat->>'Tehsil')::integer = p_access_code)
               OR (p_access_level = 'District' AND (ca.formdetails_flat->>'District')::integer = p_access_code)
               OR (p_access_level = 'Division' AND (
                    (ca.formdetails_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                    OR (ca.formdetails_flat->>'District')::integer = ANY(v_div_districts)
                  ))
              )
    ),
	    corr_counts AS (
        SELECT
            COUNT(*) FILTER (WHERE c.type IN ('Corrigendum','Amendment') AND c.status = 'sanctioned' AND c.latest_wf_status = 'forwarded')::INT AS fs_corr,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.status = 'verified' AND c.latest_wf_status = 'forwarded')::INT AS fs_verified,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'pending')::INT AS corr_pending,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'forwarded')::INT AS corr_forwarded,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'returned')::INT AS corr_returned,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'sanctioned')::INT AS corr_sanctioned,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum' AND c.latest_wf_status = 'rejected')::INT AS corr_rejected,
            COUNT(*) FILTER (WHERE c.type = 'Corrigendum')::INT AS corr_total,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'pending')::INT AS cor_pending,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'forwarded')::INT AS cor_forwarded,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'returned')::INT AS cor_returned,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'verified')::INT AS cor_verified,
            COUNT(*) FILTER (WHERE c.type = 'Correction' AND c.latest_wf_status = 'rejected')::INT AS cor_rejected,
            COUNT(*) FILTER (WHERE c.type = 'Correction')::INT AS cor_total,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'pending')::INT AS amd_pending,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'forwarded')::INT AS amd_forwarded,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'returned')::INT AS amd_returned,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'sanctioned')::INT AS amd_sanctioned,
            COUNT(*) FILTER (WHERE c.type = 'Amendment' AND c.latest_wf_status = 'rejected')::INT AS amd_rejected,
            COUNT(*) FILTER (WHERE c.type = 'Amendment')::INT AS amd_total
        FROM corrigendum c
        WHERE c.serviceid = p_service_id
          AND (p_data_type IS NULL OR c.datatype = p_data_type)
          AND (
              (c.datatype = 'legacy'
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (c.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (c.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (c.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (c.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
              OR
              (c.datatype <> 'legacy'
               AND c.latest_wf_designation = v_taken_by_trimmed
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (c.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (c.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (c.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (c.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
          )
    ),
	    wh_counts AS (
        SELECT
            COUNT(*) FILTER (WHERE w.iswithheld = true)::INT AS wh_total,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.withheldtype = 'TEMPORARY')::INT AS wh_temp,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.withheldtype = 'PERMANENT')::INT AS wh_perm,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.latest_wf_status = 'pending')::INT AS wh_pending,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.latest_wf_status = 'forwarded')::INT AS wh_forwarded,
            COUNT(*) FILTER (WHERE w.iswithheld = true AND w.latest_wf_status = 'approved')::INT AS wh_approved
        FROM withheld_applications w
        WHERE w.serviceid = p_service_id
          AND w.workflow IS NOT NULL
          AND (p_data_type IS NULL OR w.datatype = p_data_type)
          AND (
              (w.datatype = 'legacy'
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (w.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (w.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (w.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (w.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
              OR
              (w.datatype <> 'legacy'
               AND (p_taken_by IS NULL OR w.latest_wf_designation = v_taken_by_trimmed OR w.latest_wf_status = 'returntoedit')
               AND (p_access_level = 'State'
                    OR (p_access_level = 'Tehsil' AND (w.location_flat->>'Tehsil')::integer = p_access_code)
                    OR (p_access_level = 'District' AND (w.location_flat->>'District')::integer = p_access_code)
                    OR (p_access_level = 'Division' AND (
                         (w.location_flat->>'Tehsil')::integer = ANY(v_div_tehsils) 
                         OR (w.location_flat->>'District')::integer = ANY(v_div_districts)
                       ))))
          )
    ),

	    shifted_count AS (
        SELECT COUNT(DISTINCT s.reference_number) AS cnt
        FROM application_shifts s
        WHERE s.service_id = p_service_id
          AND s.designation = v_taken_by_trimmed
          AND s.shifted_from = p_access_code
          AND (p_access_level = 'State'
               OR (p_access_level = 'District' AND s.district_code = p_access_code)
               OR (p_access_level = 'Tehsil' AND s.tehsil_code = p_access_code)
               OR (p_access_level = 'Division'
                   AND (s.tehsil_code = ANY(v_div_tehsils)
                        OR s.district_code = ANY(v_div_districts))))
    ),

	    temp_disability AS (
        SELECT 0::bigint AS temp_expiring, 0::bigint AS total_pcp
        WHERE NOT v_is_pcp_service

        UNION ALL

        SELECT
            COUNT(DISTINCT CASE WHEN ca.udid_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months' THEN ca.referencenumber END)::bigint AS temp_expiring,
            COUNT(DISTINCT CASE WHEN ca.is_pcp THEN ca.referencenumber END)::bigint AS total_pcp
        FROM citizen_applications ca
        WHERE ca.serviceid = p_service_id
          AND v_is_pcp_service
          AND ca.workflow IS NOT NULL
          AND (p_access_level = 'State'
               OR (p_access_level = 'District' AND (ca.formdetails_flat->>'District')::int = p_access_code)
               OR (p_access_level = 'Tehsil' AND (ca.formdetails_flat->>'Tehsil')::int = p_access_code)
               OR (p_access_level = 'Division'
                   AND ((ca.formdetails_flat->>'District')::int = ANY(v_div_districts)
                        OR (ca.formdetails_flat->>'Tehsil')::int = ANY(v_div_tehsils))))
    ),
	    legacy_counts AS (
        SELECT 
            COUNT(*)::int AS legacy_total,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS legacy_pending,
            COUNT(*) FILTER (WHERE status = 'Forwarded')::int AS legacy_forwarded,
            COUNT(*) FILTER (WHERE status = 'Sanctioned')::int AS legacy_sanctioned,
            COUNT(*) FILTER (WHERE status = 'Rejected')::int AS legacy_rejected
        FROM citizen_applications ca
        WHERE ca.serviceid = p_service_id
          AND ca.datatype = 'legacy'
          AND ca.status <> 'Incomplete'
          AND (p_access_level = 'State'
               OR (p_access_level = 'District' AND (ca.formdetails_flat->>'District')::int = p_access_code)
               OR (p_access_level = 'Tehsil' AND (ca.formdetails_flat->>'Tehsil')::int = p_access_code)
               OR (p_access_level = 'Division'
                   AND ((ca.formdetails_flat->>'District')::int = ANY(v_div_districts)
                        OR (ca.formdetails_flat->>'Tehsil')::int = ANY(v_div_tehsils))))
    )
    SELECT 
        m.pendingcount,
        m.forwardedcount,
        m.returnedcount,
        (m.returntoedit_desig + m.returntoedit_other)::INT AS returntoeditcount,
        m.sanctionedcount,
        m.rejectcount,
        m.disbursedcount,
        (m.total_desig + m.returntoedit_other)::INT AS totalapplications,
        m.forwardedsanctionedcount,
        COALESCE(c.fs_corr, 0),
        COALESCE(c.fs_verified, 0),
        COALESCE(c.corr_pending, 0),
        COALESCE(c.corr_forwarded, 0),
        COALESCE(c.corr_returned, 0),
        COALESCE(c.corr_sanctioned, 0),
        COALESCE(c.corr_rejected, 0),
        COALESCE(c.corr_total, 0),
        COALESCE(c.cor_pending, 0),
        COALESCE(c.cor_forwarded, 0),
        COALESCE(c.cor_returned, 0),
        COALESCE(c.cor_verified, 0),
        COALESCE(c.cor_rejected, 0),
        COALESCE(c.cor_total, 0),
        COALESCE(c.amd_pending, 0),
        COALESCE(c.amd_forwarded, 0),
        COALESCE(c.amd_returned, 0),
        COALESCE(c.amd_sanctioned, 0),
        COALESCE(c.amd_rejected, 0),
        COALESCE(c.amd_total, 0),
        COALESCE(w.wh_total, 0),
        COALESCE(w.wh_temp, 0),
        COALESCE(w.wh_perm, 0),
        COALESCE(w.wh_pending, 0),
        COALESCE(w.wh_forwarded, 0),
        COALESCE(w.wh_approved, 0),
        COALESCE(s.cnt, 0),
        COALESCE(td.temp_expiring, 0),
        COALESCE(td.total_pcp, 0),
        COALESCE(l.legacy_total, 0),
        COALESCE(l.legacy_pending, 0),
        COALESCE(l.legacy_forwarded, 0),
        COALESCE(l.legacy_sanctioned, 0),
        COALESCE(l.legacy_rejected, 0)
    FROM main_counts m
    LEFT JOIN corr_counts c ON true
    LEFT JOIN wh_counts w ON true
    LEFT JOIN shifted_count s ON true
    LEFT JOIN temp_disability td ON true
    LEFT JOIN legacy_counts l ON true;
END;
$BODY$;

ALTER FUNCTION public.get_dashboard_counts(character varying, integer, integer, character varying, integer, character varying)
    OWNER TO postgres;


-- ============================================================
-- Eligibility Criteria Management Table
-- Stores dynamic eligibility criteria rules that define
-- when a citizen's eligibility for a service should be checked,
-- what conditions trigger expiration, and what actions to take.
-- ============================================================

CREATE TABLE IF NOT EXISTS eligibility_criteria (
    id SERIAL PRIMARY KEY,
    service_id INTEGER,
    criteria_name VARCHAR(255) NOT NULL,
    description TEXT,
    field_path VARCHAR(500) NOT NULL,
    expected_value VARCHAR(500),
    operator VARCHAR(50) NOT NULL DEFAULT 'equals',
    additional_value VARCHAR(500),
    date_field_path VARCHAR(500),
    reference_date_type VARCHAR(50) DEFAULT 'today',
    reference_days_offset INTEGER DEFAULT 0,
    actions JSONB DEFAULT '[]'::jsonb,
    criteria_group VARCHAR(100),
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    CONSTRAINT fk_eligibility_criteria_service 
        FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_eligibility_criteria_service_id ON eligibility_criteria(service_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_criteria_is_active ON eligibility_criteria(is_active);
CREATE INDEX IF NOT EXISTS idx_eligibility_criteria_criteria_group ON eligibility_criteria(criteria_group);

-- ============================================================
-- Function: Get eligibility criteria for a service
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_eligibility_criteria(p_service_id INTEGER DEFAULT NULL)
RETURNS TABLE(
    id INTEGER, service_id INTEGER, service_name VARCHAR(255), criteria_name VARCHAR(255),
    description TEXT, field_path VARCHAR(500), expected_value VARCHAR(500), operator VARCHAR(50),
    additional_value VARCHAR(500), date_field_path VARCHAR(500), reference_date_type VARCHAR(50),
    reference_days_offset INTEGER, actions JSONB, criteria_group VARCHAR(100),
    priority INTEGER, is_active BOOLEAN, created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql STABLE AS $BODY$
BEGIN
    RETURN QUERY
    SELECT ec.id, ec.service_id, COALESCE(s.servicename, 'N/A')::VARCHAR(255),
        ec.criteria_name, ec.description, ec.field_path, ec.expected_value, ec.operator,
        ec.additional_value, ec.date_field_path, ec.reference_date_type, ec.reference_days_offset,
        ec.actions, ec.criteria_group, ec.priority, ec.is_active, ec.created_at, ec.updated_at
    FROM eligibility_criteria ec
    LEFT JOIN services s ON ec.service_id = s.serviceid
    WHERE (p_service_id IS NULL OR ec.service_id = p_service_id) AND ec.is_active = TRUE
    ORDER BY ec.priority ASC, ec.id ASC;
END; $BODY$;

ALTER FUNCTION public.get_eligibility_criteria(INTEGER) OWNER TO postgres;


-- ============================================================
-- Function: Evaluate eligibility criteria against applications
-- Returns applications matching the specified criteria
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_eligibility_criteria(
    p_service_id INTEGER,
    p_criteria_id INTEGER DEFAULT NULL,
    p_access_level VARCHAR(20) DEFAULT 'State',
    p_access_code INTEGER DEFAULT 0
)
RETURNS TABLE(
    application_id BIGINT,
    reference_number VARCHAR(50),
    criteria_id INTEGER,
    criteria_name VARCHAR(255),
    matching_field_value VARCHAR(500),
    expiration_date DATE,
    days_until_expiry INTEGER
)
LANGUAGE plpgsql
STABLE
AS $BODY$
DECLARE
    v_criteria RECORD;
    v_field_path VARCHAR(500);
    v_date_field_path VARCHAR(500);
    v_reference_date_type VARCHAR(50);
    v_reference_days_offset INTEGER;
    v_expected_value VARCHAR(500);
    v_operator VARCHAR(50);
    v_additional_value VARCHAR(500);
BEGIN
    FOR v_criteria IN 
        SELECT * FROM eligibility_criteria 
        WHERE service_id = p_service_id 
          AND (p_criteria_id IS NULL OR id = p_criteria_id)
          AND is_active = TRUE
        ORDER BY priority ASC
    LOOP
        v_field_path := v_criteria.field_path;
        v_date_field_path := v_criteria.date_field_path;
        v_reference_date_type := COALESCE(v_criteria.reference_date_type, 'today');
        v_reference_days_offset := COALESCE(v_criteria.reference_days_offset, 0);
        v_expected_value := v_criteria.expected_value;
        v_operator := v_criteria.operator;
        v_additional_value := v_criteria.additional_value;
        
        RETURN QUERY
        WITH app_fields AS (
            SELECT 
                ca.application_id,
                ca.reference_number,
                (ca.formdetails_flat->>v_field_path) AS field_value,
                CASE 
                    WHEN v_date_field_path IS NOT NULL 
                    THEN NULLIF(ca.formdetails_flat->>v_date_field_path, '')::DATE
                    ELSE NULL
                END AS expiry_date
            FROM citizen_applications ca
            WHERE ca.serviceid = p_service_id
              AND (p_access_level = 'State' OR 
                   (p_access_level = 'District' AND (ca.formdetails_flat->>'District')::INTEGER = p_access_code))
              AND ca.status = 'Sanctioned'
        ),
        matched AS (
            SELECT 
                af.application_id,
                af.reference_number,
                af.field_value,
                af.expiry_date,
                CASE WHEN af.expiry_date IS NULL THEN NULL ELSE (CURRENT_DATE - af.expiry_date)::INTEGER END AS days_num
            FROM app_fields af
            WHERE 
                CASE v_operator
                    WHEN 'equals' THEN af.field_value = v_expected_value
                    WHEN 'not_equals' THEN af.field_value IS DISTINCT FROM v_expected_value
                    WHEN 'contains' THEN af.field_value LIKE '%' || v_expected_value || '%'
                    WHEN 'expires_within' THEN 
                        af.expiry_date IS NOT NULL 
                        AND af.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (v_additional_value)::INTERVAL
                    WHEN 'is_null' THEN af.field_value IS NULL
                    WHEN 'is_not_null' THEN af.field_value IS NOT NULL
                    ELSE TRUE
                END
        )
        SELECT 
            m.application_id,
            m.reference_number,
            v_criteria.id::INTEGER AS criteria_id,
            v_criteria.criteria_name,
            m.field_value,
            m.expiry_date,
            COALESCE(m.days_num, 0)::INTEGER AS days_until_expiry
        FROM matched m;
    END LOOP;
END;
$BODY$;

ALTER FUNCTION public.evaluate_eligibility_criteria(INTEGER, INTEGER, VARCHAR, INTEGER)
    OWNER TO postgres;




