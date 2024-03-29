import { Router } from "express";
import { verifyPubKeyRoute } from "../middleware/SignatureVerifier";
import {
  queryToPageInfo,
  queryToFilter,
  isBodyValidOpinion,
} from "../utils/ParamValidators";
import Analytics from '../utils/Analytics';
const router = Router();

router.get("/", async (req, res) => {
  const { page, pageSize } = queryToPageInfo(req.query);
  const { find, sort } = await queryToFilter(req.query);
  const { debateId, callerAddress } = req.query;
  if (!debateId) {
    res.status(400).send({ error: "Missing debate id" });
  } else {
    find.debate = debateId;
    req.context.models.Opinion.find(find)
      .select("debate creator contentType content stake pro created")
      .populate([{ path: "creator", select: "address" }])
      .limit(pageSize)
      .skip(pageSize * page)
      .sort(sort)
      .exec(function (err, opinions) {
        if (err) {
          res.status(500).send({ error: "Failed to get opinions" });
        } else {
          req.context.models.Opinion.countDocuments(find).exec(function (
            err,
            count
          ) {
            if (err) {
              res.status(500).send({ error: "Failed to count opinions" });
            } else {
              const opinionsList = opinions.map((op) => {
                const out = { ...op.toJSON() };
                out.createdByYou = op.creator.address === callerAddress;
                delete out.creator;
                delete out._id;
                delete out.debate;
                return out;
              });
              res.send({
                opinions: opinionsList?opinionsList:[],
                page: page,
                pages: Math.ceil(count / pageSize),
              });
            }
          });
        }
      });
  }
});
router.post("/new", verifyPubKeyRoute, async (req, res) => {
  if (!req.validSignature) {
    res.status(400).send({ error: "Invalid signature provided" });
  } else {
    const validationData = isBodyValidOpinion(req.body);
    if (validationData.isValid) {
      const session = await req.context.models.database.startSession();
      session.startTransaction();
      try {
        const opinion = await req.context.models.Opinion.createOpinion(
          validationData.data.address,
          validationData.data.debateId,
          validationData.data.content,
          validationData.data.contentType,
          parseInt(validationData.data.stake, 10),
          validationData.data.pro
        );
        await session.commitTransaction();
        req.context.models.Opinion.findById(opinion._id)
          .select("debate creator contentType content stake pro created")
          .populate([{ path: "creator", select: "address" }])
          .exec(function (err, opinion) {
            if (err) {
              res.status(500).send({ error: "Failed to get opinion" });
            } else {
              res.send({ opinion });
              Analytics.sendEvent(req.clientIp, validationData.data.address, "opinion", "created", validationData.data.contentType, parseInt(validationData.data.stake, 10));
            }
          });
      } catch (ex) {
        res.status(400).send({ error: ex.message });
      }
      session.endSession();
    } else {
      res.status(400).send({ error: validationData.data });
    }
  }
});

export default router;
